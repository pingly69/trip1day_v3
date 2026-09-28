/**
 * LocalStorage Master Data Cache Manager (24-Hour TTL)
 * Trip1Day Mileage Reimbursement System (ver.3.0)
 *
 * Saves Cloudflare D1 query quota by keeping Master Sites, Routes, Approvers,
 * Rates, and Config on the user's device for 24 hours with on-demand refresh.
 */

window.CacheManager = {
  MASTER_CACHE_KEY: "trip1day_master_cache_v3",
  PROFILE_CACHE_KEY: "trip1day_profile_cache_v3",

  /**
   * Retrieves cached Master Data if valid and within 24 hours.
   */
  getMasterCache: function() {
    try {
      var raw = localStorage.getItem(this.MASTER_CACHE_KEY);
      if (!raw) return null;

      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.cached_at || !parsed.data) return null;

      var ttl = (window.APP_CONFIG && window.APP_CONFIG.MASTER_CACHE_TTL_MS) || (24 * 60 * 60 * 1000);
      var age = Date.now() - parsed.cached_at;

      if (age > ttl) {
        console.log("[Cache] Master data cache expired (> 24H). Will re-fetch.");
        return null;
      }

      var hoursRemaining = ((ttl - age) / (1000 * 60 * 60)).toFixed(1);
      console.log("[Cache] Valid master data loaded from LocalStorage (Remaining: " + hoursRemaining + " hours).");
      return parsed.data;
    } catch (e) {
      console.warn("[Cache] Failed to read master cache:", e);
      return null;
    }
  },

  /**
   * Saves Master Data into LocalStorage with timestamp.
   */
  setMasterCache: function(data) {
    try {
      var payload = {
        cached_at: Date.now(),
        data: data
      };
      localStorage.setItem(this.MASTER_CACHE_KEY, JSON.stringify(payload));
      console.log("[Cache] Master data saved to LocalStorage (24H TTL).");
    } catch (e) {
      console.warn("[Cache] Failed to save master cache:", e);
    }
  },

  /**
   * Clears Master Data cache.
   */
  clearMasterCache: function() {
    try {
      localStorage.removeItem(this.MASTER_CACHE_KEY);
    } catch (e) {
      console.warn("[Cache] Failed to clear master cache:", e);
    }
  },

  /**
   * Retrieves cached user profile as fallback.
   */
  getUserProfileCache: function() {
    try {
      var raw = localStorage.getItem(this.PROFILE_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Saves user profile into LocalStorage.
   */
  setUserProfileCache: function(profile) {
    try {
      localStorage.setItem(this.PROFILE_CACHE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn("[Cache] Failed to save profile cache:", e);
    }
  }
};
