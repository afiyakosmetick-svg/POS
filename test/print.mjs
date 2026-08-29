/**
 * print.mjs - Settings -> Print: invoice + barcode.
 * Verifies the configured physical Width/Height becomes the real @page size,
 * that one barcode == one page, spacing/content toggles work, and nothing
 * silently converts the page to A4 / Letter.
 */
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="app-root"></div><div id="print-root"></div></body></html>', { url: 'http://localhost:5173/admin.html', pretendToBeVisual: true });
const { window } = dom;
const def = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
def('window', window); def('document', window.document); def('navigator', window.navigator);
def('location', window.location); def('history', window.history);
globalThis.HTMLElement = window.HTMLElement; globalThis.Node = window.Node; globalThis.CustomEvent = window.CustomEvent; globalThis.Event = window.Event;
globalThis.getComputedStyle = window.getComputedStyle;
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
window.matchMedia = globalThis.matchMedia;
def('localStorage', window.localStorage); def('sessionStorage', window.sessionStorage);
def('addEventListener', window.addEventListener.bind(window));
def('removeEventListener', window.removeEventListener.bind(window));
window.print = () => {};
globalThis.print = () => {};

const R = '../';
const { db } = await import(R + 'js/core/db.js');
const { initMockServer } = await import(R + 'js/core/mock-server.js');
const { seedDemo } = await import(R + 'js/data/seed.js');
const { session } = await import(R + 'js/core/session.js');
const { http } = await import(R + 'js/core/http.js');
initMockServer(); db.load(); if (db.isEmpty) await seedDemo(db);
await session.login('admin@afiacosmetics.shop', 'demo1234');

const pc = await import(R + 'js/core/print-config.js');
const { buildReceipt } = await import(R + 'js/pages/shared/receipt.js');
const { buildBarcodePages, buildSingleLabel } = await import(R + 'js/pages/shared/barcode-label.js');

let pass = 0, fail = 0;
const T = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (!ok && x ? ' :: ' + x : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- units ---------- */
T('toMm inch', Math.abs(pc.toMm(1, 'in') - 25.4) < 1e-9);
T('toMm mm passthrough', pc.toMm(80, 'mm') === 80);
const rs = pc.resolveSize({ pageWidth: 3, pageHeight: 5, unit: 'in' });
T('resolveSize keeps unit + converts', rs.unit === 'in' && rs.w === 3 && Math.abs(rs.wMm - 76.2) < 1e-6 && Math.abs(rs.hMm - 127) < 1e-6);

/* ---------- invoice config: defaults + legacy migration ---------- */
const iv = pc.invoiceConfig({});
T('invoice default 80mm wide', iv.pageWidth === 80 && iv.unit === 'mm');
const ivLegacy = pc.invoiceConfig({ pos: { receiptSize: 'a4' }, receipt: { header: 'My Shop', footer: 'ধন্যবাদ', showBarcode: false } });
T('legacy a4 -> 210x297mm', ivLegacy.pageWidth === 210 && ivLegacy.pageHeight === 297);
T('legacy receipt.header -> headerText', ivLegacy.headerText === 'My Shop');
T('legacy receipt.footer -> footerText', ivLegacy.footerText === 'ধন্যবাদ');
T('legacy receipt.showBarcode -> showInvoiceBarcode', ivLegacy.showInvoiceBarcode === false);
const ivNew = pc.invoiceConfig({ receipt: { header: 'x' }, print: { invoice: { headerText: 'NEW', pageWidth: 100 } } });
T('print.invoice overrides legacy', ivNew.headerText === 'NEW' && ivNew.pageWidth === 100);

/* ---------- buildReceipt: exact @page + toggles ---------- */
const S = pc.SAMPLE_SALE;
const r1 = buildReceipt(S, { settings: { print: { invoice: { ...pc.DEFAULT_INVOICE, pageWidth: 80, pageHeight: 150, unit: 'mm', pageHeightAuto: false } } } });
T('80x150mm -> @page size: 80mm 150mm', /@page\s*{\s*size:\s*80mm 150mm;\s*margin:\s*0/.test(r1), r1.slice(0, 120));
T('receipt container width 80mm', /\.receipt-preview\.inv-doc\s*{[\s\S]*?width:\s*80mm/.test(r1));
T('no A4 / Letter substitution', !/size:\s*A4/i.test(r1) && !/size:\s*letter/i.test(r1) && !r1.includes('210mm 297mm'));
const rIn = buildReceipt(S, { settings: { print: { invoice: { ...pc.DEFAULT_INVOICE, pageWidth: 3, pageHeight: 5, unit: 'in', pageHeightAuto: false } } } });
T('3x5in -> @page size: 3in 5in', /@page\s*{\s*size:\s*3in 5in/.test(rIn));
const rAuto = buildReceipt(S, { settings: { print: { invoice: { ...pc.DEFAULT_INVOICE, pageWidth: 80, unit: 'mm', pageHeightAuto: true } } } });
T('auto height -> @page size: 80mm auto', /@page\s*{\s*size:\s*80mm auto/.test(rAuto));
T('default receipt shows TOTAL + tax', r1.includes('TOTAL') && /VAT|Tax/.test(r1));
const rNoTax = buildReceipt(S, { settings: { print: { invoice: { ...pc.DEFAULT_INVOICE, showTax: false, showTaxBreakdown: false } } } });
T('showTax:false removes tax rows', !/VAT \(5%\)/.test(rNoTax) && !rNoTax.includes('>Tax<'));
const rNoBarcode = buildReceipt(S, { settings: { print: { invoice: { ...pc.DEFAULT_INVOICE, showInvoiceBarcode: false } } } });
T('showInvoiceBarcode:false removes svg', !rNoBarcode.includes('barcode-svg'));
const rSpace = buildReceipt(S, { settings: { print: { invoice: { ...pc.DEFAULT_INVOICE, marginLeft: 9, gapTable: 7, fontSize: 15 } } } });
T('spacing + font flow into scoped style', rSpace.includes('9mm') && rSpace.includes('margin-bottom: 7mm') && rSpace.includes('font-size: 15px'));
const rNoName = buildReceipt(S, { settings: { print: { invoice: { ...pc.DEFAULT_INVOICE, showItemName: false } } } });
T('showItemName:false hides product names', !rNoName.includes('Matte Lipstick'));

/* ---------- barcode: ONE barcode = ONE page ---------- */
const bc10 = buildBarcodePages([{ ...pc.SAMPLE_LABEL_ITEMS[0], qty: 10 }], { settings: {} });
T('10 barcodes => 10 pages', (bc10.match(/class="bc-page"/g) || []).length === 10, (bc10.match(/class="bc-page"/g) || []).length + '');
T('no grid: no columns template', !bc10.includes('grid-template-columns') && !bc10.includes('label-page'));
T('page-break-after: always on pages', bc10.includes('page-break-after: always') && /\.bc-page:last-child\s*{[^}]*page-break-after: auto/.test(bc10));
const bcMixed = buildBarcodePages([{ ...pc.SAMPLE_LABEL_ITEMS[0], qty: 3 }, { ...pc.SAMPLE_LABEL_ITEMS[1], qty: 2 }], { settings: {} });
T('qty expands 3 + 2 => 5 pages', (bcMixed.match(/class="bc-page"/g) || []).length === 5);

const bcMm = buildBarcodePages([pc.SAMPLE_LABEL_ITEMS[0]], { settings: { print: { barcode: { ...pc.DEFAULT_BARCODE, pageWidth: 50, pageHeight: 30, unit: 'mm' } } } });
T('50x30mm barcode -> @page size: 50mm 30mm', /@page\s*{\s*size:\s*50mm 30mm;\s*margin:\s*0/.test(bcMm));
T('bc-page dimensioned 50mm x 30mm', /\.bc-page\s*{[\s\S]*?width:\s*50mm;\s*height:\s*30mm/.test(bcMm));
const bcIn = buildBarcodePages([pc.SAMPLE_LABEL_ITEMS[0]], { settings: { print: { barcode: { ...pc.DEFAULT_BARCODE, pageWidth: 2, pageHeight: 1.2, unit: 'in' } } } });
T('2x1.2in barcode -> @page size: 2in 1.2in', /@page\s*{\s*size:\s*2in 1.2in/.test(bcIn));

const bcContent = pc.barcodeConfig({ print: { barcode: { showProductName: false, showPrice: false } } });
const oneCard = buildSingleLabel(pc.SAMPLE_LABEL_ITEMS[0], { settings: {} });
T('default barcode card shows name + number + price', oneCard.includes('Matte Lipstick') && oneCard.includes('8901234500011') && /৳/.test(oneCard));
const hidden = buildSingleLabel(pc.SAMPLE_LABEL_ITEMS[0], { settings: { print: { barcode: bcContent } } });
T('content toggles hide name + price', !hidden.includes('Matte Lipstick') && !/৳/.test(hidden));
const leftCfg = pc.barcodeConfig({ print: { barcode: { align: 'left' } } });
T('align left applied', buildSingleLabel(pc.SAMPLE_LABEL_ITEMS[0], { settings: { print: { barcode: leftCfg } } }).includes('align-items: flex-start'));

/* ---------- Settings page wiring ---------- */
document.body.innerHTML = '<div id="app-root"></div><div id="print-root"></div>';
const mount = document.getElementById('app-root');
const settingsPage = (await import(R + 'js/pages/admin/settings.js')).default;
await settingsPage({ params: {}, query: { section: 'print' } }, mount);
await sleep(140);
T('Print panel renders sub-tabs', !!mount.querySelector('#print-subtabs') && !!mount.querySelector('#print-controls'));
T('Invoice: width/height/unit inputs', !!mount.querySelector('[data-p="print.invoice.pageWidth"]') && !!mount.querySelector('[data-p="print.invoice.pageHeight"]') && !!mount.querySelector('[data-p="print.invoice.unit"]'));
T('Invoice: image upload + spacing inputs', !!mount.querySelector('#inv-logo-input') && !!mount.querySelector('[data-p="print.invoice.marginTop"]'));
T('Invoice preview rendered a receipt', !!mount.querySelector('#preview-scale .receipt-preview'));
T('Test print + Reset + Save buttons', !!mount.querySelector('#print-test') && !!mount.querySelector('#print-reset') && !!mount.querySelector('#print-save'));

mount.querySelector('#print-subtabs button[data-t="barcode"]').click();
await sleep(140);
T('Barcode: width/height/unit inputs', !!mount.querySelector('[data-p="print.barcode.pageWidth"]') && !!mount.querySelector('[data-p="print.barcode.unit"]'));
T('Barcode: barcode size + align inputs', !!mount.querySelector('[data-p="print.barcode.barcodeWidthMm"]') && !!mount.querySelector('[data-p="print.barcode.align"]'));
T('Barcode preview rendered one bc-page', !!mount.querySelector('#preview-scale .bc-page'));
T('Barcode preview meta says 1 barcode = 1 page', /1 barcode = 1 page/.test(mount.querySelector('#preview-meta').textContent));

// change width in the editor -> preview @page updates
const wIn = mount.querySelector('[data-p="print.barcode.pageWidth"]');
wIn.value = '70'; wIn.dispatchEvent(new window.Event('change'));
await sleep(220);
T('editing width updates the preview @page', /@page\s*{\s*size:\s*70/.test(mount.querySelector('#preview-scale').innerHTML));

// test print - no side effects
const salesBefore = db.collection('sales').count();
let threw = false;
try { mount.querySelector('#print-test').click(); await sleep(40); } catch { threw = true; }
T('test barcode print does not throw', !threw);
T('test print created no sale', db.collection('sales').count() === salesBefore);

/* ---------- backend persistence + deep-merge ---------- */
await http.put('/settings', { print: { invoice: { pageWidth: 76.2, unit: 'mm' }, barcode: { pageWidth: 2, pageHeight: 1, unit: 'in' } } });
const st = await http.get('/settings');
T('print.invoice.pageWidth persisted', st.print.invoice.pageWidth === 76.2);
T('print.barcode custom size persisted', st.print.barcode.pageWidth === 2 && st.print.barcode.unit === 'in');
T('deep-merge keeps other settings', st.business?.name && st.pos?.invoiceTemplate);
const cfgAfter = pc.invoiceConfig(st);
T('saved config resolves back through invoiceConfig', cfgAfter.pageWidth === 76.2);

console.log('\n===== ' + pass + ' passed, ' + fail + ' failed =====');
process.exit(fail ? 1 : 0);
