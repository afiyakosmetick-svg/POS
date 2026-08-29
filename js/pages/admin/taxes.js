/**
 * taxes.js - configurable tax / VAT. Nothing is hard-coded.
 */
import { resourcePage } from '../shared/resource-page.js';
import { pill } from '../shared/page-kit.js';
import { escapeHtml } from '../../utils/dom.js';
import taxService from '../../services/tax-service.js';

export default async function taxesPage(ctx, mount) {
  resourcePage(mount, {
    title: 'Taxes / VAT',
    subtitle: 'Define tax rates and assign them per product. Set one as the default for new products.',
    entityLabel: 'Tax',
    service: {
      list: (p) => taxService.getTaxes(p),
      create: taxService.createTax,
      update: taxService.updateTax,
      archive: taxService.archiveTax,
      restore: taxService.restoreTax,
    },
    perms: { create: 'taxes.manage', edit: 'taxes.manage', archive: 'taxes.manage' },
    columns: [
      { key: 'name', label: 'Name', sortable: true, render: (r) => `<strong>${escapeHtml(r.name)}</strong> ${r.isDefault ? pill('Default', 'brand') : ''}` },
      { key: 'rate', label: 'Rate', align: 'right', sortable: true, render: (r) => `${r.rate}%` },
      { key: 'inclusive', label: 'Type', render: (r) => pill(r.inclusive ? 'Inclusive' : 'Exclusive', r.inclusive ? 'info' : 'neutral') },
      { key: 'scope', label: 'Scope', render: (r) => escapeHtml(r.scope || 'product') },
    ],
    exportColumns: [{ key: 'name', label: 'Name' }, { key: 'rate', label: 'Rate' }, { key: 'inclusive', label: 'Inclusive' }],
    formFields: () => [
      { name: 'name', label: 'Tax name', required: true, placeholder: 'e.g. VAT 15%' },
      { name: 'rate', label: 'Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 0.01 },
      { name: 'inclusive', label: 'Price includes this tax (inclusive)', type: 'switch' },
      { name: 'scope', label: 'Applies to', type: 'select', options: [{ value: 'product', label: 'Product level' }, { value: 'category', label: 'Category level' }], value: 'product' },
      { name: 'isDefault', label: 'Use as default for new products', type: 'switch' },
    ],
    toForm: (r) => ({ name: r?.name || '', rate: r?.rate ?? 0, inclusive: !!r?.inclusive, scope: r?.scope || 'product', isDefault: !!r?.isDefault }),
    canArchive: (r) => !r.isDefault,
  });
}
