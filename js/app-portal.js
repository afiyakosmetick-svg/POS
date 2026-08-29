/**
 * app-portal.js - the Afia Cosmetics portal.
 *
 * Opens on the site URL. A shared access code unlocks the panel picker, from
 * which staff open the Admin panel or the Cashier terminal. The access code is
 * a soft front-door lock (see config.portal.accessCode) - the real protection
 * is the per-user login inside each panel.
 */
import config from './config.js';
import { boot, toggleTheme } from './core/boot.js';
import db from './core/db.js';
import { session } from './core/session.js';
import store from './core/store.js';
import { icon } from './components/icons.js';
import { escapeHtml } from './utils/dom.js';
import { initials } from './utils/format.js';
import { mountLangSwitch } from './components/lang-switch.js';

const UNLOCK_KEY = 'afia_portal_unlock_v1';
const card = document.getElementById('portal-card');

document.getElementById('theme-toggle').addEventListener('click', () => toggleTheme());
document.getElementById('portal-version').textContent = `Afia Cosmetics POS · v${config.app.version}`;

(async () => {
  await boot();
  mountLangSwitch(document.querySelector('.portal__foot'));
  // try to restore an existing staff session (so we can show "continue as…")
  let current = null;
  try {
    current = await session.restore();
  } catch { /* not signed in */ }

  if (isUnlocked()) renderPicker(current);
  else renderGate(current);
})().catch((err) => {
  console.error(err);
  card.innerHTML = `<div class="alert alert--danger"><div class="alert__body">Could not start: ${escapeHtml(err.message)}. Serve the site over HTTP (see README).</div></div>`;
});

/* ---------------------------------------------------------------- unlock */
function isUnlocked() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(UNLOCK_KEY) || localStorage.getItem(UNLOCK_KEY));
    if (!raw) return false;
    const ageMin = (Date.now() - raw.at) / 60000;
    return ageMin < (config.portal.unlockMinutes || 720);
  } catch {
    return false;
  }
}
function setUnlocked(remember) {
  const payload = JSON.stringify({ at: Date.now() });
  try {
    sessionStorage.setItem(UNLOCK_KEY, payload);
    if (remember) localStorage.setItem(UNLOCK_KEY, payload);
    else localStorage.removeItem(UNLOCK_KEY);
  } catch { /* storage disabled */ }
}
function lock() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
    localStorage.removeItem(UNLOCK_KEY);
  } catch { /* ignore */ }
  renderGate(null);
}

/* ------------------------------------------------------------------ gate */
function renderGate() {
  card.innerHTML = `
    <form class="portal-gate" id="gate-form" autocomplete="off" novalidate>
      <span style="width:44px;height:44px;border-radius:var(--radius-md);background:var(--accent-soft);color:var(--accent-text);display:grid;place-content:center;margin:0 auto">${icon('shield', { size: 20 })}</span>
      <h2>Staff access</h2>
      <p>Enter the Afia Cosmetics access code to continue.</p>
      <input class="input portal-gate__input" id="code" name="code" maxlength="16"
             inputmode="text" autocapitalize="characters" autocomplete="off"
             spellcheck="false" aria-label="Access code" placeholder="••••••••" autofocus>
      <div class="portal-gate__error" id="code-error" role="alert"></div>
      <label class="check" style="justify-content:center"><input type="checkbox" id="remember"> Remember this device</label>
      <button class="btn btn--primary btn--lg btn--block" type="submit">Unlock portal</button>
    </form>`;

  const form = document.getElementById('gate-form');
  const input = document.getElementById('code');
  const errEl = document.getElementById('code-error');
  input.focus();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const entered = input.value.trim().toUpperCase();
    if (entered === String(config.portal.accessCode).toUpperCase()) {
      setUnlocked(document.getElementById('remember').checked);
      renderPicker(store.get('user') ? { user: store.get('user') } : null);
    } else {
      errEl.textContent = 'Incorrect access code. Ask a manager for the current code.';
      input.value = '';
      input.focus();
      input.animate(
        [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 220 },
      );
    }
  });
  input.addEventListener('input', () => (errEl.textContent = ''));
}

/* -------------------------------------------------------------- picker */
function renderPicker(current) {
  const user = current?.user || store.get('user') || null;

  const accounts = (() => {
    try {
      return db
        .collection('users')
        .all()
        .filter((u) => u.status === 'active')
        .map((u) => ({
          name: u.name,
          email: u.email,
          role: db.collection('roles').get(u.roleId)?.name || 'Staff',
        }));
    } catch {
      return [];
    }
  })();

  card.innerHTML = `
    ${user ? `
    <div class="portal-session">
      <span class="avatar avatar--sm">${escapeHtml(initials(user.name))}</span>
      <div class="grow">Signed in as <strong>${escapeHtml(user.name)}</strong><br>
        <span class="muted">${escapeHtml(user.roleName || user.role?.name || '')}</span></div>
      <button class="btn btn--ghost btn--sm" id="signout">Sign out</button>
    </div>` : ''}

    <div class="portal-panels">
      <a class="panel-card panel-card--admin" href="admin.html">
        <span class="panel-card__icon">${icon('dashboard', { size: 22 })}</span>
        <h3>Admin Panel</h3>
        <p>Products, inventory, barcodes, brands, categories, purchases, customers, staff, reports &amp; settings.</p>
        <span class="panel-card__go">Open admin ${icon('arrow-left', { size: 14, cls: 'flip' })}</span>
      </a>
      <a class="panel-card panel-card--pos" href="cashier.html">
        <span class="panel-card__icon">${icon('pos', { size: 22 })}</span>
        <h3>Cashier / POS</h3>
        <p>Fast checkout terminal — scan, add to cart, take payment, print the receipt.</p>
        <span class="panel-card__go">Open cashier ${icon('arrow-left', { size: 14 })}</span>
      </a>
    </div>

    ${accounts.length ? `
    <details class="portal-accounts">
      <summary>Who can sign in (${accounts.length})</summary>
      <table><tbody>
        ${accounts.map((a) => `<tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.role)}</td><td class="mono">${escapeHtml(a.email)}</td></tr>`).join('')}
      </tbody></table>
      <p class="muted" style="margin-top:6px;font-size:var(--fs-xs)">Password for all demo accounts: <code>demo1234</code></p>
    </details>` : ''}

    <div style="margin-top:var(--sp-4);display:flex;justify-content:space-between;align-items:center">
      <span class="muted" style="font-size:var(--fs-xs)">Portal unlocked on this device.</span>
      <button class="btn btn--ghost btn--sm" id="lock">${icon('shield', { size: 14 })} Lock portal</button>
    </div>`;

  document.querySelectorAll('.panel-card .flip').forEach((s) => (s.style.transform = 'rotate(180deg)'));
  document.getElementById('lock')?.addEventListener('click', lock);
  document.getElementById('signout')?.addEventListener('click', async () => {
    await session.logout({ redirect: false });
    renderPicker(null);
  });
}
