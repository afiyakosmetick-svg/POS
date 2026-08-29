# Afia POS

A modern, framework-free **web Point-of-Sale system** for retail. Three surfaces —
a **Portal** front door, an **Admin console** for owners/managers, and a
**Cashier terminal** built for fast checkout. Vanilla HTML/CSS/ES2022, no build
step, backend-ready.

Built as the demo shop **"Afia Cosmetics"** (Dhaka, BDT ৳), with two branches,
seven roles, ~40 products, and ~30 days of realistic sales history.

---

## Highlights

| Area | What it does |
|---|---|
| **Portal** | The URL opens a portal gated by a shared staff **access code**; from there staff enter the Admin panel or the Cashier terminal. No subscription, no super-admin — direct access. |
| **Cashier POS** | Barcode + search + category grid, cart with per-line & cart discounts, price override, hold/resume, customer create/select, cash/card/mobile/**mixed** payment with change, atomic checkout, receipt print. Keyboard-first (F1/F2/F4/F8/F9). |
| **Exchange / Return** | In the cashier terminal: **scan the invoice barcode** → the original sale loads → pick products + return quantities → **Return** (refund, method chosen) or **Exchange** (swap products, auto price-difference, customer pays or is refunded). Partial + duplicate-return safe, branch-aware restock, one controlled transaction, printable receipt. Flows into the admin list, dashboard and reports. |
| **Inventory** | Ledger-based. Every movement (sale, purchase, return, exchange, adjustment, transfer, opening) writes an immutable `inventory_transactions` row **and** updates a cached balance in one transaction. Refresh never changes stock. Branch-scoped. |
| **Transaction safety** | Checkout validates cart → availability → money → payment, then creates sale + items + payments + ledger entries + a unique invoice number **atomically**. Idempotency key prevents double sales on double-click / refresh / retry. |
| **Products** | Sectioned add/edit form: info · attributes (colour / size / variant) · variants · pricing (**Purchase / MRP / Selling**) · **per-branch opening stock → auto total** · barcode. Bulk import/export (CSV), duplicate, safe archiving (history preserved), image upload (auto-resized). |
| **Purchasing** | Purchase orders, partial receiving (increases stock), purchase returns (decreases stock), supplier statements & payments. |
| **Cash register** | Open with float, cash in/out, close with expected-vs-counted reconciliation and printable Z-report. |
| **Reports** | ~20 reports (sales, profit, inventory, stock movement, tax/VAT, cashier, product/category performance, daily closing, returns & exchanges, …) with date filters, print, CSV/JSON export. |
| **Dashboard** | Fully interactive BI: every KPI card / chart point / payment method drills into the report → transaction → entity. Global date-range control drives everything; numbers reconcile with their reports. |
| **Printing** | **Settings → Print** controls the real print output. Invoice: exact custom page size (mm / inch), spacing, logo, visible fields, live preview, test print. Barcode: **one barcode = one page** at the configured physical label size, fixed content order (Brand → Name → Colour \| Size \| Variant → Barcode → Number → ~~MRP~~ Price). Barcode Generator auto-loads the barcode quantity from a product's total branch stock. |
| **Language** | Runtime **English / বাংলা** switch — one DOM-walking translator covers the whole interface, no per-string source edits; bundled self-hosted **Hind Siliguri** Bangla font; preference persists. |
| **RBAC** | Granular permissions enforced **in the service layer** (`requirePermission` throws) and used to hide UI. 7 role presets + custom roles + per-user overrides. |
| **Multi-branch** | Stock, sales, purchases, registers and staff assignments are all branch-aware. Top-bar branch switcher. |
| **Responsive** | One interface across mobile / tablet / laptop / desktop — sidebar collapses to a drawer, the POS cart becomes a bottom sheet, tables scroll inside their own container, modals become sheets. No feature is hidden. |
| **Offline / PWA** | A service worker + a sync queue that holds sales made offline and replays them (idempotently) on reconnect — never overwriting newer data. Opt-in via `APP_ENABLE_PWA`. |
| **Design system** | CSS design tokens, light & dark themes, accessible modals/menus, print stylesheets. |

---

## Quick start

The app uses **ES modules**, so it must be served over HTTP (not opened as a
`file://` URL). No dependencies, no build.

```bash
node serve.mjs            # bundled zero-dependency static server (port 5173)
# — or any other static server —
python -m http.server 5173
npx serve -l 5173
# — or the VS Code "Live Server" extension —
```

Then open <http://localhost:5173/>. The **portal** opens first — unlock it with
the demo access code **`AFIA2026`**, then choose Admin or Cashier and sign in
with a demo account:

| Role | Email | Password |
|---|---|---|
| Business Owner | `admin@afiacosmetics.shop` | `demo1234` |
| Manager | `manager@afiacosmetics.shop` | `demo1234` |
| Cashier | `cashier@afiacosmetics.shop` | `demo1234` |
| Inventory Manager | `inventory@afiacosmetics.shop` | `demo1234` |
| Accountant | `accounts@afiacosmetics.shop` | `demo1234` |

The demo dataset seeds automatically on first load. Reset it any time from
**Settings → Backup / Data Management**.

> The access code is a soft front-door lock (`config.portal.accessCode`, or
> `APP_PORTAL_CODE`); the real protection is the per-user login inside each panel.
> Demo credentials and sample data are for evaluation — replace them before any
> real use.

---

## Project structure

```
/  index.html · portal.html · login.html · admin.html · cashier.html
   manifest.webmanifest · service-worker.js · serve.mjs
├── css/      reset · tokens · base · layout · components · admin · cashier
│             portal · print · responsive
├── assets/   logos/ (svg) · fonts/ (Hind Siliguri woff2) · icons/ · img/
├── data/     README of the persisted JSON shapes
├── test/     Node + jsdom smoke tests (run.mjs)
└── js/
    ├── config.js                    runtime configuration surface
    ├── app-portal.js / app-login.js / app-admin.js / app-cashier.js   entry controllers
    ├── admin-nav.js                  sidebar model
    ├── core/
    │   ├── db.js                     localStorage document store + transactions + sequences
    │   ├── mock-server.js + mock/    in-process REST backend (route modules)
    │   ├── http.js                   transport: mock ⇄ real fetch (one flag)
    │   ├── print-config.js           the one print/label configuration source
    │   ├── i18n.js                   runtime DOM translator (en ⇄ bn)
    │   ├── router.js  event-bus.js  store.js  session.js  rbac.js  sync-queue.js  boot.js
    ├── data/     permissions.js · schema.js · seed.js · i18n-bn.js
    ├── services/ domain services (auth, product, inventory, sales, settings, …) over http.js
    ├── components/  toast · modal · confirm · drawer · data-table · form · chart · tabs
    │                dropdown · pagination · empty-state · skeleton · kpi-card
    │                barcode · icons · lang-switch
    └── pages/
        ├── admin/    dashboard, products (+form/detail), categories, brands, inventory,
        │             stock-adjustments, purchases (+form/detail), purchase-returns, suppliers,
        │             sales (+detail), sales-returns (Exchange/Return), invoices, customers,
        │             employees, expenses, cash-register, discounts, taxes, reports,
        │             audit-logs, notifications, branches, settings, backup, help,
        │             barcode-generator
        ├── cashier/  pos · cart · payment · exchange-return
        └── shared/   page-kit · receipt · return-receipt · barcode-label · sale-drawer
```

### Architecture (layer separation)

```
UI (pages / components)
      │  imports only services
      ▼
Services (domain API, permission checks)
      │  http.get('/products') …
      ▼
http.js  ──► mock mode ──► mock-server.js ──► db.js (localStorage)
         └─► rest mode ──► fetch(baseUrl + path)   ← flip config.api.mode
```

* **Money** is stored & computed as **integer minor units** (paisa). No float
  arithmetic on financial values — see `js/utils/money.js`.
* **Historical documents** (sale items, purchase lines) keep their own snapshots
  of name/SKU/price, so archiving a product never changes an old invoice.
* **Invoice numbers** are per-branch sequences allocated *inside* the sale
  transaction and never reused.

---

## Connecting a real backend

1. Set the data mode and API base URL (env vars consumed by `js/config.js`, or
   edit `config.js` directly):

   ```
   APP_DATA_MODE=rest
   APP_API_BASE_URL=https://api.yourshop.com/v1
   ```

   or inject at runtime before the app scripts:

   ```html
   <script>window.__AFIA_ENV__ = { APP_DATA_MODE: 'rest', APP_API_BASE_URL: '…' };</script>
   ```

2. Implement the REST endpoints the mock server already defines. The contract is
   the route table in `js/core/mock/*.routes.js` — same paths, same request /
   response shapes. Examples:

   ```
   POST /auth/login            → { token, user, role, business, branches }
   GET  /products?search=&page=&pageSize=&sort=&dir=&categoryId=&status=&allBranches=
   POST /products              → accepts branchStock:[{branchId, qty}]
   POST /sales                 → atomic checkout (accepts idempotencyKey)
   POST /sales/:id/returns     → return OR exchange (type, lines, replacementItems)
   POST /inventory/adjustments
   GET  /reports/:type?preset=|from=&to=
   PUT  /settings              → deep-merged (settings.print.*, …)
   ```

3. The frontend already sends `credentials: 'include'` and an `X-CSRF-Token`
   header (from a `csrf_token` cookie). No other changes are needed — services,
   components and pages are untouched.

`js/services/media-service.js` contains the integration point for object storage
(images are client-side data URLs in mock mode).

### Backend responsibilities (not in this frontend)

Authentication with a slow password KDF (argon2/bcrypt), signed sessions/JWT,
server-side rate limiting, CSRF token issuance, real atomic DB transactions,
and audit-log immutability. **No secrets belong in any frontend-served file.**

---

## Deployment

Static hosting — any of:

* **Netlify / Vercel / Cloudflare Pages / GitHub Pages**: deploy the repo root
  as-is. No build command. Output directory: `.`
* **Nginx / Apache / S3+CloudFront**: upload the repo contents. Ensure
  `.webmanifest` is served as `application/manifest+json` and `.svg` as
  `image/svg+xml`. Serve `service-worker.js` from the site root with
  `Cache-Control: no-cache`.
* **Docker**: `FROM nginx:alpine` + `COPY . /usr/share/nginx/html`.

HTTPS is required for the service worker and camera barcode scanning.

### Environment configuration

See [`.env.example`](.env.example). All values are **public** (data mode, API
base URL, feature flags, currency). Secret keys are backend-only and are listed
there for integrator reference, commented out.

---

## Development notes

* No framework, no bundler. Edit a file, refresh.
* `js/components/*` are the reusable primitives; `js/pages/shared/*` compose them
  into page kits (`pageShell`, `resourcePage`, `receipt`, `page-kit`).
* Charts are hand-rolled canvas (`js/components/chart.js`) — theme-aware, no libs.
* Barcodes are a from-scratch Code128 SVG encoder (`js/components/barcode.js`).
* To wipe local state during development: DevTools → Application → Local Storage →
  delete the `afia_pos_*` keys, or use Settings → Backup → *Start blank*.

### Automated tests

Node smoke tests live in [`test/`](test/) (the app itself has no dependencies;
the tests use `jsdom` to simulate a browser):

```bash
cd test && npm install && npm test
```

* `backend.mjs` — mock backend end-to-end + integrity rules: stock reconciles
  with the ledger, no negative stock, unique invoice numbers, idempotent
  checkout, atomic rollback on a failed sale, returns restock, payment
  validation, RBAC, persistence.
* `render.mjs` — every admin page + detail pages + the POS render without errors.
* `pos-checkout.mjs` — full cashier flow: add → quantity → payment → complete →
  cart cleared.
* `portal.mjs` — access-code gate, panel picker, session.
* `app-boot.mjs` — full admin + cashier bootstrap; the responsive sidebar drawer
  (toggle / backdrop / Escape / route-close) and POS cart button.
* `dashboard.mjs` — the interactive BI dashboard: every card equals its report.
* `i18n.mjs` — en ⇄ bn translation of the whole interface, persistence, font.
* `print.mjs` — Settings → Print: the configured physical Width/Height becomes
  the real `@page` size; no A4/Letter substitution.
* `product-barcode.mjs` — per-branch opening stock → total → barcode quantity,
  MRP validation, the barcode sticker's fixed content order.
* `exchange-return.mjs` — scan invoice → return / exchange, price difference,
  branch-isolated restock/deduct, insufficient-stock block, admin + dashboard.

10 suites · 281 assertions, all green.

### Manual testing checklist

Auth & RBAC · product/category CRUD · barcode search · cart & quantity · discounts
· tax calculation · payment (cash/card/mixed + change) · sale completion · invoice
generation & printing · stock deduction on sale · stock addition on purchase
receive · sales return (stock back) · purchase return (stock out) · customer &
supplier management · cash register open/close · expenses · every report ·
permission enforcement · responsive layouts · dark mode · **refresh persistence**
· **duplicate-sale prevention** · error handling.

---

## License

Provided as a reference implementation. Replace demo branding, credentials and
sample data before any production use.
