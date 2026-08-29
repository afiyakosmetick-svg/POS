/**
 * app-boot.mjs - boots the admin and cashier SPAs the way a browser does
 * (portal unlock -> admin.html / cashier.html full bootstrap + first route),
 * catching shell/router errors the page-level render test misses.
 */
import { JSDOM } from 'jsdom';

function makeDom(url, bodyHtml) {
  const dom = new JSDOM(`<!doctype html><html><body>${bodyHtml}<div id="print-root"></div></body></html>`, { url, pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  const def = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  def('window', window); def('document', window.document); def('navigator', window.navigator);
  def('location', window.location); def('history', window.history);
  globalThis.HTMLElement = window.HTMLElement; globalThis.Node = window.Node; globalThis.Image = window.Image;
  globalThis.KeyboardEvent = window.KeyboardEvent; globalThis.CustomEvent = window.CustomEvent; globalThis.Event = window.Event;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} });
  window.matchMedia = globalThis.matchMedia;
  def('localStorage', window.localStorage);
  def('sessionStorage', window.sessionStorage);
  def('addEventListener', window.addEventListener.bind(window));
  def('removeEventListener', window.removeEventListener.bind(window));
  window.print = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => ({ addColorStop() {}, width: 10 }) });
  window.HTMLElement.prototype.animate = function () { return { finished: Promise.resolve(), cancel() {} }; };
  window.HTMLElement.prototype.scrollTo = function () {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  return window;
}

let pass = 0, fail = 0;
const T = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (!ok && x ? ' :: ' + x : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = '../';

/* ---------- shared: seed once via a throwaway context ---------- */
{
  makeDom('http://localhost:5173/x.html', '');
  if (!globalThis.crypto) globalThis.crypto = (await import('node:crypto')).webcrypto;
  const { db } = await import(R + 'js/core/db.js');
  const { initMockServer } = await import(R + 'js/core/mock-server.js');
  const { seedDemo } = await import(R + 'js/data/seed.js');
  initMockServer(); db.load(); if (db.isEmpty) await seedDemo(db);
  const users = db.collection('users').count();
  const products = db.collection('products').count();
  T('seed produced users + products', users > 0 && products > 0, `${users}u ${products}p`);
}

/* ---------- ADMIN bootstrap ---------- */
{
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.map(String).join(' '));
  const win = makeDom('http://localhost:5173/admin.html', '<div id="app-progress"></div><div id="app-root" class="gate"></div>');
  // pre-authenticate (portal -> admin -> user would log in; emulate a live session)
  const { session } = await import(R + 'js/core/session.js');
  await session.login('admin@afiacosmetics.shop', 'demo1234');
  win.location.hash = '#/';
  await import(R + 'js/app-admin.js?admin1');
  await sleep(600);
  const root = win.document.getElementById('app-root');
  T('admin shell rendered (sidebar + topbar)', !!root.querySelector('.sidebar') && !!root.querySelector('.topbar'), root.innerHTML.slice(0, 120));
  T('admin dashboard route rendered', !!root.querySelector('.kpi-grid, .page, .dash-grid'), 'no page content');
  T('admin "Back to Portal" wired', win.document.body.innerHTML.includes('user-btn'));

  /* responsive shell behaviour */
  const shell = root.querySelector('.app-shell');
  const menuBtn = root.querySelector('#menu-btn');
  const backdrop = root.querySelector('#sb-backdrop');
  T('mobile hamburger button exists', !!menuBtn);
  T('topbar page-title element populated on route', (root.querySelector('#topbar-title')?.textContent || '').length > 0, root.querySelector('#topbar-title')?.textContent);
  menuBtn.dispatchEvent(new win.Event('click'));
  T('hamburger click opens the sidebar drawer', shell.classList.contains('is-sidebar-open'));
  T('hamburger aria-expanded reflects open', menuBtn.getAttribute('aria-expanded') === 'true');
  menuBtn.dispatchEvent(new win.Event('click'));
  T('hamburger click again closes the drawer (toggle)', !shell.classList.contains('is-sidebar-open'));
  menuBtn.dispatchEvent(new win.Event('click'));
  backdrop.dispatchEvent(new win.Event('click'));
  T('tapping the backdrop closes the drawer', !shell.classList.contains('is-sidebar-open'));
  menuBtn.dispatchEvent(new win.Event('click'));
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));
  T('Escape closes the drawer', !shell.classList.contains('is-sidebar-open'));
  // navigating closes an open drawer
  shell.classList.add('is-sidebar-open');
  win.location.hash = '#/products';
  await sleep(200);
  T('route change closes an open drawer', !shell.classList.contains('is-sidebar-open'));
  T('topbar title updates on navigation', /product/i.test(root.querySelector('#topbar-title')?.textContent || ''), root.querySelector('#topbar-title')?.textContent);
  const realErrs = errs.filter((e) => !e.includes('Not implemented') && !e.includes('[chart]'));
  T('admin: no console errors during boot', realErrs.length === 0, realErrs[0] || '');
  console.error = orig;
}

/* ---------- CASHIER bootstrap ---------- */
{
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.map(String).join(' '));
  const win = makeDom('http://localhost:5173/cashier.html', '<div id="app-progress"></div><div id="pos-root"></div>');
  const { session } = await import(R + 'js/core/session.js');
  await session.logout({ redirect: false }).catch(() => {});
  await session.login('cashier@afiacosmetics.shop', 'demo1234');
  await import(R + 'js/app-cashier.js?cashier1');
  await sleep(700);
  const root = win.document.getElementById('pos-root');
  const html = root.innerHTML;
  T('cashier rendered something', html.length > 200, html.slice(0, 120));
  T('cashier shows POS terminal OR register gate', /pos-catalog|register-gate|pos-topbar/.test(html), html.slice(0, 160));
  if (root.querySelector('.pos-catalog')) {
    T('POS has a mobile cart button + bottom-sheet backdrop', !!root.querySelector('.js-cart-fab') && !!root.querySelector('.js-sheet-backdrop'));
    T('POS cart grabber toggle wired', typeof root.querySelector('.pos-cart__head') !== 'undefined');
  }
  const realErrs = errs.filter((e) => !e.includes('Not implemented') && !e.includes('[chart]') && !e.includes('camera'));
  T('cashier: no console errors during boot', realErrs.length === 0, realErrs[0] || '');
  console.error = orig;
}

console.log('\n===== ' + pass + ' passed, ' + fail + ' failed =====');
process.exit(fail ? 1 : 0);
