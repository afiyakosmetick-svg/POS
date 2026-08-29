/**
 * branches.js - multi-branch management. Stock is branch-scoped.
 */
import { resourcePage } from '../shared/resource-page.js';
import { statusBadge, pill } from '../shared/page-kit.js';
import { escapeHtml } from '../../utils/dom.js';
import branchService from '../../services/branch-service.js';
import bus from '../../core/event-bus.js';

export default async function branchesPage(ctx, mount) {
  resourcePage(mount, {
    title: 'Branches',
    subtitle: 'Each branch keeps its own stock, cash registers, sales and staff assignments.',
    entityLabel: 'Branch',
    service: {
      list: (p) => branchService.getBranches(p),
      create: async (payload) => {
        const b = await branchService.createBranch(payload);
        await refreshBranches();
        return b;
      },
      update: async (id, payload) => {
        const b = await branchService.updateBranch(id, payload);
        await refreshBranches();
        return b;
      },
      archive: async (id) => {
        const r = await branchService.archiveBranch(id);
        await refreshBranches();
        return r;
      },
    },
    perms: { create: 'branches.manage', edit: 'branches.manage', archive: 'branches.manage' },
    columns: [
      { key: 'name', label: 'Branch', sortable: true, render: (r) => `<strong>${escapeHtml(r.name)}</strong> ${r.isDefault ? pill('Default', 'brand') : ''}${r.openRegister ? ' ' + pill('Register open', 'success') : ''}<br><span class="muted text-xs mono">${escapeHtml(r.code)}</span>` },
      { key: 'address', label: 'Address', render: (r) => escapeHtml(r.address || '—') },
      { key: 'phone', label: 'Phone', render: (r) => escapeHtml(r.phone || '—') },
      { key: 'employeeCount', label: 'Staff', align: 'right' },
      { key: 'productsInStock', label: 'SKUs in stock', align: 'right' },
      { key: 'status', label: 'Status', render: (r) => statusBadge(r.archivedAt ? 'archived' : r.status || 'active') },
    ],
    canArchive: (r) => !r.isDefault,
    formFields: () => [
      { name: 'name', label: 'Branch name', required: true },
      { name: 'code', label: 'Short code', hint: 'Used in invoice numbers, e.g. BAN', suffix: '' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'address', label: 'Address', type: 'textarea', rows: 2, colSpan: 'full' },
      { name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], value: 'active' },
    ],
    toForm: (r) => ({ name: r?.name || '', code: r?.code || '', phone: r?.phone || '', email: r?.email || '', address: r?.address || '', status: r?.status || 'active' }),
  });

  async function refreshBranches() {
    const res = await branchService.getBranches({ pageSize: 'all' });
    const list = (res.data || res).filter((b) => !b.archivedAt);
    const s = (await import('../../core/store.js')).default;
    s.set({ branches: list });
    bus.emit('branches:updated');
  }
}
