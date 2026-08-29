/**
 * payment.js - payment modal. Resolves with a payments[] array or null.
 * Supports cash (with change), card, mobile, bank transfer and mixed payment.
 */
import { openModal } from '../../components/modal.js';
import { icon } from '../../components/icons.js';
import { escapeHtml } from '../../utils/dom.js';
import money from '../../utils/money.js';
import config from '../../config.js';

const METHODS = [
  { id: 'cash', label: 'Cash', icon: 'banknote' },
  { id: 'card', label: 'Card', icon: 'credit-card' },
  { id: 'mobile', label: 'Mobile', icon: 'smartphone' },
  { id: 'bank_transfer', label: 'Bank', icon: 'building' },
];

const MOBILE_PROVIDERS = [
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
  { id: 'rocket', label: 'Rocket' },
  { id: 'other', label: 'Other' },
];

export function openPayment({ total, customer }) {
  return new Promise((resolve) => {
    let mixed = false;
    let method = 'cash';
    const amounts = { cash: 0, card: 0, mobile: 0, bank_transfer: 0 };
    let cashReceived = 0;
    let settled = false;

    const m = openModal({
      title: 'Take Payment',
      size: 'lg',
      onClose: () => !settled && resolve(null),
      body: `<div class="pay-grid">
        <div class="pay-total-box">
          <span class="label">Amount to pay</span>
          <div class="amount">${money.format(total)}</div>
        </div>
        <div class="row" style="grid-column:1/-1;justify-content:space-between">
          <label class="switch"><input type="checkbox" class="js-mixed"><span class="switch__track"><span class="switch__thumb"></span></span><span>Split / mixed payment</span></label>
          ${customer ? `<span class="badge badge--brand">${escapeHtml(customer.name)}</span>` : ''}
        </div>
        <div class="pay-method-grid js-methods">
          ${METHODS.map((mt) => `<button type="button" class="pay-method ${mt.id === 'cash' ? 'is-active' : ''}" data-m="${mt.id}">${icon(mt.icon, { size: 20 })}${mt.label}</button>`).join('')}
        </div>
        <div class="js-single" style="grid-column:1/-1">
          <div class="js-cash-block">
            <label class="field"><span class="label">Cash received</span>
              <input class="input js-cash-received" type="number" inputmode="decimal" step="0.01" placeholder="0.00" style="font-size:var(--fs-xl);height:52px">
            </label>
            <div class="quick-cash js-quick" style="margin-top:var(--sp-2)"></div>
          </div>
          <label class="field js-provider-field" hidden style="margin-top:var(--sp-3)"><span class="label">Mobile banking provider</span>
            <select class="select js-provider">${MOBILE_PROVIDERS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}</select>
          </label>
          <label class="field js-ref-field" hidden style="margin-top:var(--sp-3)"><span class="label">Reference / txn ID <span class="opt">optional</span></span>
            <input class="input js-ref" placeholder="e.g. bKash TrxID, card auth code">
          </label>
        </div>
        <div class="js-mixed-block" hidden style="grid-column:1/-1">
          ${METHODS.map((mt) => `<label class="field field--row" style="margin-bottom:var(--sp-2)">
            <span class="label" style="width:120px">${mt.label}</span>
            <input class="input js-mix" data-m="${mt.id}" type="number" inputmode="decimal" step="0.01" placeholder="0.00">
          </label>`).join('')}
        </div>
        <div class="change-box js-change" style="grid-column:1/-1">
          <span>Change due</span><span class="amount js-change-amt">${money.format(0)}</span>
        </div>
      </div>`,
      footer: `<button class="btn btn--ghost js-cancel">Cancel</button>
        <button class="btn btn--success btn--lg js-confirm">${icon('check', { size: 18 })} Confirm Payment</button>`,
    });

    const $ = (s) => m.$(s);
    const quick = $('.js-quick');
    (config.pos.quickCashDenominations || [100, 500, 1000]).forEach((d) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = money.format(money.toMinor(d), { withSymbol: false });
      b.addEventListener('click', () => {
        $('.js-cash-received').value = d;
        recalc();
      });
      quick.appendChild(b);
    });
    const exactBtn = document.createElement('button');
    exactBtn.type = 'button';
    exactBtn.textContent = 'Exact';
    exactBtn.addEventListener('click', () => {
      $('.js-cash-received').value = money.toMajor(total);
      recalc();
    });
    quick.appendChild(exactBtn);

    $('.js-mixed').addEventListener('change', (e) => {
      mixed = e.target.checked;
      $('.js-single').hidden = mixed;
      $('.js-methods').style.opacity = mixed ? '0.4' : '1';
      $('.js-methods').style.pointerEvents = mixed ? 'none' : 'auto';
      $('.js-mixed-block').hidden = !mixed;
      recalc();
    });

    $('.js-methods').addEventListener('click', (e) => {
      const btn = e.target.closest('.pay-method');
      if (!btn) return;
      method = btn.dataset.m;
      m.$$('.pay-method').forEach((x) => x.classList.toggle('is-active', x === btn));
      $('.js-cash-block').hidden = method !== 'cash';
      $('.js-ref-field').hidden = method === 'cash';
      $('.js-provider-field').hidden = method !== 'mobile';
      recalc();
    });

    $('.js-cash-received').addEventListener('input', recalc);
    m.$$('.js-mix').forEach((i) => i.addEventListener('input', recalc));

    function recalc() {
      let paid = 0;
      let cash = 0;
      if (mixed) {
        m.$$('.js-mix').forEach((i) => {
          const v = money.toMinor(i.value || 0);
          amounts[i.dataset.m] = v;
          paid += v;
          if (i.dataset.m === 'cash') cash += v;
        });
      } else if (method === 'cash') {
        cashReceived = money.toMinor($('.js-cash-received').value || 0);
        cash = cashReceived;
        paid = Math.min(cashReceived, total) + Math.max(0, 0); // cash covers up to total
        paid = cashReceived; // for validation we pass full tender
      } else {
        paid = total;
      }
      const effectivePaid = mixed ? paid : (method === 'cash' ? cashReceived : total);
      const change = Math.max(0, (method === 'cash' && !mixed ? cashReceived : effectivePaid) - total);
      const short = Math.max(0, total - effectivePaid);
      const box = $('.js-change');
      if (short > 0) {
        box.classList.add('is-due');
        box.querySelector('span').textContent = 'Still due';
        $('.js-change-amt').textContent = money.format(short);
      } else {
        box.classList.remove('is-due');
        box.querySelector('span').textContent = 'Change due';
        $('.js-change-amt').textContent = money.format(change);
      }
      $('.js-confirm').disabled = short > 0.0001;
    }

    $('.js-cancel').addEventListener('click', () => m.close());
    $('.js-confirm').addEventListener('click', () => {
      const payments = [];
      if (mixed) {
        for (const mt of METHODS) {
          const v = amounts[mt.id];
          if (v > 0) payments.push({ method: mt.id, amount: v });
        }
      } else if (method === 'cash') {
        payments.push({ method: 'cash', amount: cashReceived });
      } else if (method === 'mobile') {
        payments.push({ method: 'mobile', provider: $('.js-provider').value, amount: total, reference: $('.js-ref').value.trim() || null });
      } else {
        payments.push({ method, amount: total, reference: $('.js-ref').value.trim() || null });
      }
      settled = true;
      resolve(payments);
      m.close();
    });

    setTimeout(() => $('.js-cash-received')?.focus(), 100);
    recalc();
  });
}

export default openPayment;
