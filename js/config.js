/**
 * config.js - single runtime configuration surface.
 *
 * For a pure static deploy, edit values here. For build-tool deploys, wire the
 * `window.__AFIA_ENV__` object (injected by your host) which takes precedence.
 * NEVER place secrets (JWT secret, gateway keys, DB credentials) in this file.
 */

const injected = (typeof window !== 'undefined' && window.__AFIA_ENV__) || {};

export const config = Object.freeze({
  app: {
    name: injected.APP_NAME || 'Afia Cosmetics',
    shortName: 'Afia Cosmetics',
    tagline: 'Point of Sale',
    version: '1.0.0',
    build: '2026.08',
    supportEmail: injected.APP_SUPPORT_EMAIL || 'support@afiacosmetics.shop',
  },

  portal: {
    /**
     * Access code for the portal landing page. This is a soft front-door lock
     * so the panel links are not exposed to anyone who finds the URL - the real
     * protection is the per-user login inside each panel. Change it here (or via
     * APP_PORTAL_CODE) and share it only with staff.
     */
    accessCode: injected.APP_PORTAL_CODE || 'AFIA2026',
    /** Minutes the unlocked portal stays open in this browser tab session. */
    unlockMinutes: 720,
  },

  api: {
    /** 'mock' -> in-browser localStorage DB. 'rest' -> real backend via fetch. */
    mode: injected.APP_DATA_MODE || 'mock',
    baseUrl: (injected.APP_API_BASE_URL || '').replace(/\/$/, ''),
    /** Simulated latency for the mock server (ms) so loading states are real. */
    mockLatencyMs: Number(injected.APP_MOCK_LATENCY_MS ?? 90),
    /** Attach credentials / CSRF header when talking to a real backend. */
    withCredentials: true,
    csrfHeader: 'X-CSRF-Token',
    timeoutMs: 20000,
  },

  storage: {
    /** Root localStorage key. Bump the version to force a clean migration. */
    dbKey: 'afia_pos_db_v3',
    sessionKey: 'afia_pos_session_v2',
    prefsKey: 'afia_pos_prefs_v2',
    syncQueueKey: 'afia_pos_sync_queue_v2',
    /** Debounced write delay to batch rapid mutations. */
    persistDebounceMs: 120,
  },

  locale: {
    default: injected.APP_DEFAULT_LOCALE || 'en-BD',
    currency: injected.APP_DEFAULT_CURRENCY || 'BDT',
    currencySymbol: '৳', // ৳
    /** Minor units per major unit for money math (2 => paisa/cents). */
    currencyMinorUnits: 2,
    timezone: 'Asia/Dhaka',
  },

  pos: {
    /** Blank barcode focus after each add for continuous scanning. */
    autoFocusBarcode: true,
    /** Prevent completing a sale that would drive stock below zero. */
    allowNegativeStock: false,
    holdSaleLimit: 20,
    quickCashDenominations: [50, 100, 200, 500, 1000],
    receiptDefaultSize: '80', // '58' | '80' | 'a4'
    printAfterSale: true,
  },

  security: {
    sessionIdleTimeoutMin: 30,
    /** Client-side guard only; real rate limiting is a backend concern. */
    loginAttemptWindowMs: 15 * 60 * 1000,
    loginMaxAttempts: 8,
    passwordMinLength: 8,
  },

  features: {
    pwa: String(injected.APP_ENABLE_PWA ?? 'false') === 'true', // off while stabilising; flip to 'true' + bump SW VERSION to re-enable
    cameraScanner: String(injected.APP_ENABLE_CAMERA_SCANNER ?? 'true') === 'true',
    multiBranch: true,
    loyaltyPoints: true,
  },

  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  },
});

export default config;
