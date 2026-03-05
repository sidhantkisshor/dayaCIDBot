// DayaCID Bot — Configuration & Constants

// In production (Vercel), TELEGRAM_BOT_TOKEN must be set as an env var.
// The fallback is a revoked dev token — it will NOT work in production.
export const TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'DEV_TOKEN_NOT_SET';

// Upstash Redis (optional — bot works without these, just loses persistence)
// Accepts both Upstash default names and our custom names
export const KV_REST_API_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
export const KV_REST_API_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

// Admin notification channel (optional — set to a Telegram chat ID)
export const ADMIN_CHANNEL_ID = process.env.ADMIN_CHANNEL_ID || '';

// Spam detection thresholds (defaults, overridable via dashboard)
const DEFAULTS = {
  SPAM_THRESHOLD: 6,
  INSTANT_BAN_THRESHOLD: 10,
  MAX_WARNINGS_BEFORE_BAN: 3,
};

// Runtime overrides from dashboard (loaded from KV on first access)
let _overrides = null;
let _overridesLoadedAt = 0;
const OVERRIDE_CACHE_MS = 60000; // Re-check KV every 60s

async function loadOverrides() {
  if (_overrides && (Date.now() - _overridesLoadedAt < OVERRIDE_CACHE_MS)) return _overrides;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) { _overrides = {}; return _overrides; }
  try {
    const resp = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent('dashboard:config')}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
    const data = await resp.json();
    _overrides = data.result ? JSON.parse(data.result) : {};
  } catch {
    _overrides = _overrides || {};
  }
  _overridesLoadedAt = Date.now();
  return _overrides;
}

export function getThreshold(key) {
  // Synchronous read from cache (returns default if overrides not loaded yet)
  const val = _overrides?.[key];
  return (typeof val === 'number' && Number.isFinite(val)) ? val : DEFAULTS[key];
}

// Pre-load overrides on module init (fire-and-forget)
loadOverrides().catch(() => {});

// Trigger a reload on next access (called periodically)
export { loadOverrides };

// Export defaults for backward compatibility — prefer getThreshold() for overridable values
export const SPAM_THRESHOLD = DEFAULTS.SPAM_THRESHOLD;
export const INSTANT_BAN_THRESHOLD = DEFAULTS.INSTANT_BAN_THRESHOLD;

export const USER_REPORT_ACTION_THRESHOLD = 5;
export const USER_REPORT_BAN_THRESHOLD = 8;
export const USER_REPORT_BONUS = 3;
export const REPORTS_FOR_AUTO_ACTION = 3;  // unique reporters needed for auto-restrict

// Enforcement durations (seconds)
export const MUTE_DURATION_1ST = 3600;      // 1 hour
export const MUTE_DURATION_2ND = 86400;     // 24 hours
export const MAX_WARNINGS_BEFORE_BAN = DEFAULTS.MAX_WARNINGS_BEFORE_BAN;

// Flood detection
export const FLOOD_WINDOW_MS = 60000;       // 60 seconds
export const FLOOD_THRESHOLD = 4;           // messages per window
export const BURST_WINDOW_MS = 3000;        // 3 seconds
export const BURST_THRESHOLD = 3;           // messages per burst window

// Captcha
export const CAPTCHA_TIMEOUT_MS = 120000;   // 2 minutes to solve
export const CAPTCHA_OPTIONS_COUNT = 4;     // number of answer buttons

// Auto-delete bot messages after this many ms
export const AUTO_DELETE_DELAY_MS = 60000;  // 60 seconds

// CAS cache TTL
export const CAS_CACHE_TTL_MS = 3600000;   // 1 hour

// KV TTLs (seconds)
export const KV_WARNING_TTL = 604800;       // 7 days
