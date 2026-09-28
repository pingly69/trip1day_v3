/**
 * Trip1Day Frontend Configuration (ver.3.0)
 * Allows customizing LIFF ID and API base URL without rebuilding
 */
window.APP_CONFIG = {
  // Default LIFF ID (Can be overridden by /api/config or updated here)
  LIFF_ID: "2009016720-k0zSXOrx",

  // API Base URL (empty string means same origin)
  API_BASE_URL: "",

  // App Version identifier
  APP_VERSION: "v3.0",

  // LocalStorage Cache Duration for Master Data: 24 Hours in milliseconds
  MASTER_CACHE_TTL_MS: 24 * 60 * 60 * 1000,

  // Enable Mock Mode for browser development outside LINE App
  ALLOW_DEV_MOCK: true,
  DEFAULT_MOCK_UID: "USER-LOCAL-TEST"
};
