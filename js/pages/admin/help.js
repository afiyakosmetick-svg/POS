/**
 * help.js - in-app help & support.
 */
import { pageShell } from '../shared/page-kit.js';
import { escapeHtml } from '../../utils/dom.js';
import config from '../../config.js';
import store from '../../core/store.js';

const FAQ = [
  ['How is stock kept accurate?', 'Every stock change (sale, purchase, return, adjustment, transfer) writes an immutable row to the inventory ledger and updates a cached balance in the same transaction. Refreshing the page never recalculates from screen state, so numbers cannot drift.'],
  ['Can a sale be duplicated by double-clicking?', 'No. Each checkout generates an idempotency key. The "Pay" button locks while processing, and a repeated submission with the same key returns the original sale instead of creating a new one.'],
  ['What happens to sales if I archive a product?', 'Nothing. Sale line items store a snapshot of the product name, SKU and price at the time of sale. Archiving only hides the product from the POS and active lists — history stays valid, and you can restore it.'],
  ['How do keyboard shortcuts work at the till?', 'F1 focuses search, F2 the barcode field, F4 opens customer selection, F8 holds the sale, F9 (or Ctrl+Enter) opens payment, and Esc closes dialogs.'],
  ['How do I switch branches?', 'Use the branch selector in the top bar. Stock, sales, purchases and registers are all scoped to the selected branch.'],
  ['Is my data safe if I close the browser?', 'In this demo, data is stored locally in your browser and persists across refreshes and restarts. Export a JSON backup from Settings → Backup regularly. When connected to a real backend, data lives on the server.'],
  ['How do I connect a real backend?', 'Set APP_DATA_MODE=rest and APP_API_BASE_URL in your environment (or js/config.js). Every service already speaks to a REST-style API via js/core/http.js — no UI changes are needed.'],
];

export default async function helpPage(ctx, mount) {
  const shell = pageShell(mount, { title: 'Help & Support', subtitle: `${config.app.name} POS v${config.app.version} · ${config.app.build}` });
  shell.body.innerHTML = `
    <div class="form-layout">
      <div class="form-layout__main">
        <div class="card">
          <div class="card__header"><h3>Frequently asked questions</h3></div>
          <div class="card__body stack" style="--stack-gap:0">
            ${FAQ.map(([q, a]) => `<details style="border-bottom:1px solid var(--border-subtle);padding:var(--sp-3) 0">
              <summary style="font-weight:600;cursor:pointer">${escapeHtml(q)}</summary>
              <p class="muted text-sm" style="margin-top:var(--sp-2)">${escapeHtml(a)}</p>
            </details>`).join('')}
          </div>
        </div>
        <div class="card card--pad">
          <div class="form-section-title">Cashier quick reference</div>
          <div class="kbd-hints" style="gap:var(--sp-4)">
            <span><kbd>F1</kbd> Search</span><span><kbd>F2</kbd> Barcode</span><span><kbd>F4</kbd> Customer</span>
            <span><kbd>F8</kbd> Hold sale</span><span><kbd>F9</kbd> Payment</span>
            <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> Complete sale</span><span><kbd>Esc</kbd> Close dialog</span>
            <span><kbd>Ctrl</kbd>+<kbd>K</kbd> Global search (admin)</span>
          </div>
        </div>
      </div>
      <div class="form-layout__side">
        <div class="card card--pad">
          <div class="form-section-title">Support</div>
          <dl class="detail-list">
            <div class="detail-list__row"><dt>Email</dt><dd><a href="mailto:${config.app.supportEmail}">${config.app.supportEmail}</a></dd></div>
            <div class="detail-list__row"><dt>Business</dt><dd>${escapeHtml(store.get('business')?.name || '—')}</dd></div>
            <div class="detail-list__row"><dt>Signed in as</dt><dd>${escapeHtml(store.get('user')?.name || '')} (${escapeHtml(store.get('user')?.roleName || '')})</dd></div>
          </dl>
        </div>
        <div class="card card--pad">
          <div class="form-section-title">Data mode</div>
          <p class="text-sm">${config.api.mode === 'mock' ? 'Running on the local demo database. Your changes are saved in this browser.' : `Connected to <span class="mono">${escapeHtml(config.api.baseUrl)}</span>`}</p>
          <a class="btn btn--outline btn--sm btn--block" href="#/backup" style="margin-top:var(--sp-2)">Backup / restore data</a>
        </div>
      </div>
    </div>`;
}
