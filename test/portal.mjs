/**
 * portal.mjs - the portal landing: code gate -> panel picker.
 */
import { JSDOM } from 'jsdom';
const dom = new JSDOM(
  '<!doctype html><html><body><div id="portal-card"></div><button id="theme-toggle"></button><span id="portal-version"></span></body></html>',
  { url: 'http://localhost:5173/portal.html', pretendToBeVisual: true },
);
const { window } = dom;
const def = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
def('window', window); def('document', window.document); def('navigator', window.navigator);
def('location', window.location); def('history', window.history);
globalThis.HTMLElement = window.HTMLElement; globalThis.Node = window.Node;
globalThis.KeyboardEvent = window.KeyboardEvent; globalThis.CustomEvent = window.CustomEvent;
globalThis.getComputedStyle = window.getComputedStyle;
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
window.matchMedia = globalThis.matchMedia;
def('localStorage', window.localStorage);
def('sessionStorage', window.sessionStorage);
def('addEventListener', window.addEventListener.bind(window));
def('removeEventListener', window.removeEventListener.bind(window));
window.HTMLElement.prototype.animate = function () { return { finished: Promise.resolve() }; };

const R = '../';
const { db } = await import(R + 'js/core/db.js');
const { initMockServer } = await import(R + 'js/core/mock-server.js');
const { seedDemo } = await import(R + 'js/data/seed.js');
const config = (await import(R + 'js/config.js')).default;
initMockServer(); db.load(); if (db.isEmpty) await seedDemo(db);

let pass = 0, fail = 0;
const T = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (!ok && x ? ' :: ' + x : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
console.error = (...a) => errs.push(a.map(String).join(' '));

await import(R + 'js/app-portal.js');
await sleep(300);

const card = document.getElementById('portal-card');
T('code gate rendered', !!card.querySelector('#gate-form'), card.textContent.slice(0, 60));
T('has code input', !!card.querySelector('#code'));

// wrong code
card.querySelector('#code').value = 'WRONG';
card.querySelector('#gate-form').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
await sleep(50);
T('wrong code shows error + stays on gate', !!card.querySelector('#gate-form') && card.querySelector('#code-error').textContent.length > 0);

// right code
card.querySelector('#code').value = config.portal.accessCode;
card.querySelector('#gate-form').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
await sleep(80);
T('correct code unlocks -> panel picker', !!card.querySelector('.portal-panels'));
const links = [...card.querySelectorAll('.panel-card')].map((a) => a.getAttribute('href'));
T('admin panel link', links.includes('admin.html'), links.join(','));
T('cashier panel link', links.includes('cashier.html'), links.join(','));
T('staff accounts listed', !!card.querySelector('.portal-accounts'));

// lock again
card.querySelector('#lock').click();
await sleep(50);
T('lock returns to gate', !!card.querySelector('#gate-form'));

T('no console errors', errs.filter((e) => !e.includes('Not implemented')).length === 0, errs[0] || '');

console.log('\n===== ' + pass + ' passed, ' + fail + ' failed =====');
process.exit(fail ? 1 : 0);
