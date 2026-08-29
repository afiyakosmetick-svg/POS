/**
 * auth.routes.js - mock authentication endpoints.
 * Real deployments replace these with a backend that issues signed sessions,
 * enforces rate limiting server-side, and stores argon2/bcrypt hashes.
 */

import db from '../db.js';
import { ok, fail, notFound, badRequest } from './router.js';
import { audit } from './helpers.js';
import { setActor, getActor } from './context.js';
import { hashPassword, verifyPassword, issueToken } from '../../utils/crypto.js';
import { now } from '../../utils/date.js';
import config from '../../config.js';

function hydrateUser(user) {
  const role = db.collection('roles').get(user.roleId) || null;
  const employee = db.collection('employees').findOne({ userId: user.id });
  const branchIds = employee?.branchIds || db.collection('branches').all().map((b) => b.id);
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      avatar: user.avatar || null,
      roleId: user.roleId,
      roleName: role?.name || 'User',
      status: user.status,
      permissionGrants: user.permissionGrants || [],
      permissionRevokes: user.permissionRevokes || [],
      discountLimitPct: role?.discountLimitPct ?? 0,
      branchIds,
      lastLoginAt: user.lastLoginAt || null,
    },
    role,
  };
}

export default function register(router) {
  router.post('/auth/login', async ({ body }) => {
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) badRequest('Email and password are required', { email: !email ? 'Required' : undefined, password: !password ? 'Required' : undefined });

    const user = db.collection('users').findOne((u) => u.email.toLowerCase() === email);
    // Constant-ish response to avoid user enumeration in the demo.
    if (!user) {
      await hashPassword(password);
      return fail(401, 'Incorrect email or password');
    }
    if (user.status !== 'active') return fail(403, 'This account is deactivated. Contact an administrator.');

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      audit('login_failed', 'user', user.id, { meta: { email } });
      return fail(401, 'Incorrect email or password');
    }

    db.collection('users').update(user.id, { lastLoginAt: now() });
    const token = issueToken(user.id);
    const hydrated = hydrateUser(db.collection('users').get(user.id));
    setActor({ ...hydrated.user });
    audit('login', 'user', user.id, { meta: { email } });

    const business = db.collection('businesses').all()[0] || null;
    const branches = db.collection('branches').find({ archivedAt: { $exists: false } });
    const subscription = db.collection('subscriptions').all()[0] || null;

    return ok({
      token,
      expiresAt: new Date(Date.now() + config.security.sessionIdleTimeoutMin * 60000).toISOString(),
      ...hydrated,
      business,
      branches,
      subscription,
    });
  });

  router.get('/auth/me', async () => {
    const actor = getActor();
    if (!actor) return fail(401, 'Not authenticated');
    const user = db.collection('users').get(actor.id);
    if (!user) return fail(401, 'Session user no longer exists');
    const hydrated = hydrateUser(user);
    const business = db.collection('businesses').all()[0] || null;
    const branches = db.collection('branches').find({ archivedAt: { $exists: false } });
    const subscription = db.collection('subscriptions').all()[0] || null;
    return ok({ ...hydrated, business, branches, subscription });
  });

  router.post('/auth/logout', async () => {
    const actor = getActor();
    if (actor) audit('logout', 'user', actor.id);
    setActor(null);
    return ok({ ok: true });
  });

  router.post('/auth/change-password', async ({ body }) => {
    const actor = getActor();
    if (!actor) return fail(401, 'Not authenticated');
    const user = db.collection('users').get(actor.id);
    if (!user) notFound('User');

    const current = String(body?.currentPassword || '');
    const next = String(body?.newPassword || '');
    if (next.length < config.security.passwordMinLength) {
      badRequest('Password too short', { newPassword: `Use at least ${config.security.passwordMinLength} characters` });
    }
    if (!(await verifyPassword(current, user.passwordHash))) {
      badRequest('Current password is incorrect', { currentPassword: 'Incorrect' });
    }
    db.collection('users').update(user.id, { passwordHash: await hashPassword(next) });
    audit('update', 'user', user.id, { meta: { field: 'password' } });
    return ok({ ok: true });
  });
}
