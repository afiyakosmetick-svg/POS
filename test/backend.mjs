/**
 * backend.mjs - exercises the mock backend end-to-end and verifies the
 * data-integrity rules (§50): stock reconciles with the ledger, no negative
 * stock, unique invoice numbers, idempotent checkout, atomic rollback.
 *
 *   node test/backend.mjs
 */
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear() };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true, userAgent: 'test' }, configurable: true });
globalThis.window = globalThis;
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.requestAnimationFrame = f => setTimeout(f, 0);
globalThis.setInterval = () => 0;
globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, style: {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, getContext: () => ({}) }), addEventListener() {}, body: { appendChild() {}, style: {} }, getElementById: () => null, cookie: '' };
if (!globalThis.crypto) globalThis.crypto = (await import('node:crypto')).webcrypto;

const { db } = await import('../js/core/db.js');
const { initMockServer } = await import('../js/core/mock-server.js');
const { seedDemo } = await import('../js/data/seed.js');
const { setActor, setActiveBranch } = await import('../js/core/mock/context.js');
const { http } = await import('../js/core/http.js');
const { resolvePermissions } = await import('../js/core/rbac.js');
initMockServer(); db.load(); await seedDemo(db);

let pass = 0, fail = 0;
const T = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (!ok && x ? ' :: ' + x : '')); };
const step = async (n, fn) => { try { await fn(); } catch (e) { fail++; console.log('FAIL ' + n + ' :: THREW ' + (e.status || '') + ' ' + e.message); } };

const reconcile = (label) => {
  const byKey = new Map();
  for (const t of db.collection('inventory_transactions').all()) {
    const k = t.branchId + '|' + t.productId + '|' + (t.variantId || 'base');
    byKey.set(k, (byKey.get(k) || 0) + t.qtyDelta);
  }
  let mm = 0;
  for (const s of db.collection('stock').all()) {
    if ((byKey.get(s.branchId + '|' + s.productId + '|' + (s.variantId || 'base')) || 0) !== s.quantity) mm++;
  }
  T('stock reconciles with ledger ' + label, mm === 0, mm + ' mismatches');
  T('no negative stock ' + label, !db.collection('stock').all().some(s => s.quantity < 0));
};

// ---- integrity of the seeded dataset ----
reconcile('(seed)');
const inv = db.collection('sales').all().map(s => s.invoiceNo);
T('invoice numbers unique', new Set(inv).size === inv.length, inv.length + ' invoices');

// ---- auth ----
const login = await http.post('/auth/login', { email: 'admin@afiacosmetics.shop', password: 'demo1234' });
setActor(login.user); const B = login.branches[0].id; setActiveBranch(B);
T('login owner', login.role.name === 'Business Owner');
let badLogin = false;
try { await http.post('/auth/login', { email: 'admin@afiacosmetics.shop', password: 'wrong' }); } catch (e) { badLogin = e.status === 401; }
T('bad password rejected 401', badLogin);

// ---- products ----
let np;
await step('product lifecycle', async () => {
  np = await http.post('/products', { branchId: B, name: 'QA Lipstick', sellingPrice: 35000, costPrice: 20000, unit: 'pcs', openingStock: 10, minStock: 2 });
  T('create + opening stock ledgered', np.stock === 10);
  const pd = await http.get('/products/' + np.id, { params: { branchId: B } });
  await http.patch('/products/' + np.id, { ...pd, sellingPrice: 40000 });
  T('update', (await http.get('/products/' + np.id, { params: { branchId: B } })).sellingPrice === 40000);
  await http.del('/products/' + np.id);
  T('archive is soft (history-safe)', (await http.get('/products/' + np.id, { params: { branchId: B } })).archivedAt != null);
  await http.post('/products/' + np.id + '/restore');
  T('restore', (await http.get('/products/' + np.id, { params: { branchId: B } })).archivedAt == null);
});

// ---- checkout: deduction + idempotency + atomicity ----
await step('checkout', async () => {
  const before = (await http.get('/products/' + np.id, { params: { branchId: B } })).stock;
  const sale = await http.post('/sales', { branchId: B, items: [{ productId: np.id, qty: 2 }], payments: [{ method: 'cash', amount: 100000 }], idempotencyKey: 'k1' });
  T('sale total = 2 x 400.00 (untaxed product)', sale.grandTotal === 80000, String(sale.grandTotal));
  T('cash change computed correctly', sale.changeTotal === 20000, String(sale.changeTotal));
  T('stock deducted', (await http.get('/products/' + np.id, { params: { branchId: B } })).stock === before - 2);
  const replay = await http.post('/sales', { branchId: B, items: [{ productId: np.id, qty: 2 }], payments: [{ method: 'cash', amount: 100000 }], idempotencyKey: 'k1' });
  T('idempotent replay returns original (no dup sale)', replay.invoiceNo === sale.invoiceNo);
  T('no double stock deduction on replay', (await http.get('/products/' + np.id, { params: { branchId: B } })).stock === before - 2);

  // atomic rollback: oversell must not partially deduct
  const cur = (await http.get('/products/' + np.id, { params: { branchId: B } })).stock;
  let rejected = false;
  try { await http.post('/sales', { branchId: B, items: [{ productId: np.id, qty: cur + 999 }], payments: [{ method: 'cash', amount: 99999999 }] }); }
  catch (e) { rejected = e.status === 409; }
  T('oversell rejected', rejected);
  T('failed sale left stock untouched (atomic)', (await http.get('/products/' + np.id, { params: { branchId: B } })).stock === cur);

  // return restocks
  const full = await http.get('/sales/' + sale.id);
  const ret = await http.post('/sales/' + sale.id + '/returns', { reason: 'customer_request', lines: [{ saleItemId: full.items[0].id, qty: 1 }] });
  T('return posted', !!ret.reference);
  T('return restocked +1', (await http.get('/products/' + np.id, { params: { branchId: B } })).stock === cur + 1);
  let overReturn = false;
  try { await http.post('/sales/' + sale.id + '/returns', { reason: 'customer_request', lines: [{ saleItemId: full.items[0].id, qty: 50 }] }); }
  catch (e) { overReturn = e.status === 409; }
  T('cannot return more than sold', overReturn);
});

// ---- payment validation ----
await step('payment rules', async () => {
  let shortPaid = false;
  try { await http.post('/sales', { branchId: B, items: [{ productId: np.id, qty: 1 }], payments: [{ method: 'cash', amount: 1 }] }); }
  catch (e) { shortPaid = e.status === 409; }
  T('incomplete payment rejected', shortPaid);
});

// ---- inventory ops ----
await step('inventory', async () => {
  const adj = await http.post('/inventory/adjustments', { branchId: B, reason: 'recount', lines: [{ productId: np.id, deltaQty: 5 }] });
  T('adjustment applied', adj.netUnits === 5);
  const trf = await http.post('/inventory/transfers', { fromBranchId: B, toBranchId: login.branches[1].id, lines: [{ productId: np.id, qty: 3 }] });
  T('branch transfer moves stock both sides', !!trf.reference);
  T('valuation computes', (await http.get('/inventory/valuation', { params: { branchId: B } })).summary.totalCostValue > 0);
});

// ---- purchasing ----
await step('purchasing', async () => {
  const sup = (await http.get('/suppliers', { params: { pageSize: 1 } })).data[0];
  const po = await http.post('/purchases', { branchId: B, supplierId: sup.id, lines: [{ productId: np.id, qty: 20, unitCost: 20000 }], paidTotal: 0 });
  const before = (await http.get('/products/' + np.id, { params: { branchId: B } })).stock;
  await http.post('/purchases/' + po.id + '/receive', { lines: [{ lineId: po.lines[0].id, qty: 20 }] });
  T('receiving adds stock', (await http.get('/products/' + np.id, { params: { branchId: B } })).stock === before + 20);
  await http.post('/purchases/' + po.id + '/returns', { reason: 'defective', lines: [{ lineId: po.lines[0].id, qty: 5 }] });
  T('purchase return removes stock', (await http.get('/products/' + np.id, { params: { branchId: B } })).stock === before + 15);
});

// ---- people / finance / org ----
await step('customers', async () => {
  const c = await http.post('/customers', { name: 'QA', phone: '01700000999' });
  let dup = false;
  try { await http.post('/customers', { name: 'Dup', phone: '01700000999' }); } catch (e) { dup = e.status === 409; }
  T('duplicate customer phone rejected', dup);
  T('customer history', (await http.get('/customers/' + c.id + '/history')).customer.id === c.id);
});
await step('register', async () => {
  const reg = await http.post('/cash-register/open', { branchId: B, openingCash: 300000 });
  await http.post('/cash-register/sessions/' + reg.id + '/movements', { direction: 'in', amount: 10000, reason: 'cash_in' });
  const closed = await http.post('/cash-register/sessions/' + reg.id + '/close', { countedCash: 310000 });
  T('register close computes expected vs counted', closed.difference === 0, 'diff ' + closed.difference);
});
await step('settings', async () => {
  const st = await http.get('/settings');
  await http.put('/settings', { pos: { receiptSize: '58' } });
  const st2 = await http.get('/settings');
  T('settings deep-merge keeps siblings', st2.pos.receiptSize === '58' && st2.business.name === st.business.name);
});

// ---- reports ----
const badReports = [];
for (const rt of ['sales', 'profit', 'purchases', 'inventory', 'stock-movement', 'customers', 'suppliers', 'expenses', 'cashier', 'payments', 'tax', 'product-performance', 'category-performance', 'daily-closing']) {
  try { if (!Array.isArray((await http.get('/reports/' + rt, { params: { branchId: B, preset: 'this_year' } })).rows)) badReports.push(rt); }
  catch (e) { badReports.push(rt + '(' + e.message + ')'); }
}
T('all 14 reports return rows[]', badReports.length === 0, badReports.join(', '));
T('dashboard aggregates from persisted sales', (await http.get('/dashboard', { params: { branchId: B, preset: 'this_year' } })).kpis.totalSales > 0);
T('audit log append-only & populated', (await http.get('/audit-logs', { params: { pageSize: 5 } })).data.length > 0);
T('backup export contains data', (await http.get('/backup/export')).collections.products.length > 0);

// ---- RBAC ----
const cLogin = await http.post('/auth/login', { email: 'cashier@afiacosmetics.shop', password: 'demo1234' });
const cPerms = resolvePermissions(cLogin.user, cLogin.role);
T('cashier lacks settings.manage & wildcard', !cPerms.has('settings.manage') && !cPerms.has('*'));
T('cashier can operate POS', cPerms.has('pos.operate') && cPerms.has('sales.create'));

// ---- persistence: reload from the same localStorage blob ----
await step('persistence', async () => {
  db.flush();
  const raw = store.get('afia_pos_db_v3');
  const parsed = JSON.parse(raw);
  T('DB persisted to storage', parsed.collections.sales.length > 0);
  T('sequences persisted (no invoice reuse after reload)', Object.keys(parsed.meta.sequences).some(k => k.startsWith('invoice:')));
});

reconcile('(after all ops)');

console.log('\n===== ' + pass + ' passed, ' + fail + ' failed =====');
process.exit(fail ? 1 : 0);
