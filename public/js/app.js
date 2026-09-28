/**
 * Main Application Store, LIFF Bootstrap & Router (ver.3.0)
 * Trip1Day Mileage Reimbursement System
 */

window.AppState = {
  lineUserId: "USER-LOCAL-TEST",
  lineDisplayName: "",
  requesterName: "",
  plateNo: "",
  selectedDate: "",
  selectedSiteId: "",
  travelPurpose: "",
  tollFee: 0,
  parkFee: 0,
  flatRateFee: 0,
  useFlatRate: false,
  selectedApprover: "",
  currentTxId: null,
  currentTransactionStatus: "DRAFT",
  pendingDeleteTxId: null,
  trips: [],
  masterData: null,
  userProfile: null,
  dailyTransactions: [],
  currentScreen: "summary_list",
  isLineLoggedIn: false,

  resetFormState: function() {
    this.currentTxId = null;
    this.currentTransactionStatus = "DRAFT";
    this.selectedSiteId = "";
    this.travelPurpose = "";
    this.tollFee = 0;
    this.parkFee = 0;
    this.flatRateFee = 0;
    this.useFlatRate = false;

    // Default 1 Trip Card
    this.trips = [{
      trip_id: window.TripCardComponent.generateTripId(),
      trip_no: 1,
      type: "CUSTOM",
      trip_type: "SINGLE",
      route_id: null,
      route_name: "ระบุเอง",
      origin: "",
      dest: "",
      km: ""
    }];
  },

  loadTransactionDetailIntoState: function(detail) {
    this.currentTxId = detail.transaction_id;
    this.requesterName = detail.req_name;
    this.plateNo = detail.plate_no;
    this.selectedDate = detail.req_date;
    this.selectedSiteId = detail.site_id;
    this.travelPurpose = detail.travel_purpose;
    this.tollFee = detail.toll_fee;
    this.parkFee = detail.park_fee;
    this.flatRateFee = detail.flat_rate_fee;
    this.useFlatRate = detail.flat_rate_fee > 0;
    this.selectedApprover = detail.approver;
    this.currentTransactionStatus = detail.status;
    this.trips = detail.trip_details || [];
  },

  findTrip: function(tripId) {
    for (var i = 0; i < this.trips.length; i++) {
      if (this.trips[i].trip_id === tripId) return this.trips[i];
    }
    return null;
  },

  findRoute: function(routeId) {
    var routes = (this.masterData && this.masterData.routes) ? this.masterData.routes : [];
    for (var i = 0; i < routes.length; i++) {
      if (String(routes[i].route_id) === String(routeId)) return routes[i];
    }
    return null;
  },

  removeTrip: function(tripId) {
    this.trips = this.trips.filter(function(t) { return t.trip_id !== tripId; });
    for (var i = 0; i < this.trips.length; i++) {
      this.trips[i].trip_no = i + 1;
    }
  }
};

window.App = {
  init: async function() {
    console.log("[App] Trip1Day ver.3.0 Initializing...");
    var container = document.getElementById("app-screen-container");
    if (container) {
      container.innerHTML = '<div style="text-align:center; padding: 60px 20px;"><span class="spinner"></span> กำลังเริ่มต้นระบบ...</div>';
    }

    // 1. Fetch runtime config from server (LIFF ID, etc.)
    await this.loadConfig();

    // 2. Initialize LINE LIFF
    await this.initLiff();

    // 3. Load Master Data (Using 24-Hour LocalStorage Cache)
    await this.loadMasterData();

    // 4. Load User Profile & Today Thailand Date
    await this.loadUserProfile();

    // 5. Navigate to Day Summary List
    this.navigateTo("summary_list");
  },

  loadConfig: async function() {
    try {
      var configData = await window.ApiClient.request("/api/config");
      if (configData && configData.liff_id) {
        window.APP_CONFIG.LIFF_ID = configData.liff_id;
        window.APP_CONFIG.ALLOW_DEV_MOCK = configData.allow_dev_mock;
        console.log("[App] Config loaded from server: LIFF_ID=" + configData.liff_id);
      }
    } catch (err) {
      console.warn("[App] Could not load /api/config, using default config.js:", err);
    }
  },

  initLiff: function() {
    return new Promise(function(resolve) {
      if (typeof liff === "undefined") {
        console.warn("[App] LINE LIFF SDK not loaded. Operating in Dev/Browser mode.");
        resolve();
        return;
      }

      var liffId = (window.APP_CONFIG && window.APP_CONFIG.LIFF_ID) || "2009016720-k0zSXOrx";

      liff.init({ liffId: liffId }).then(function() {
        if (!liff.isLoggedIn()) {
          window.AppState.isLineLoggedIn = false;
          // If in dev mock mode and outside LINE client, allow testing without redirect
          if (!liff.isInClient() && window.APP_CONFIG && window.APP_CONFIG.ALLOW_DEV_MOCK) {
            console.log("[App] Running outside LINE with Dev Mock enabled. Using mock user.");
            resolve();
          } else {
            console.log("[App] User not logged in, redirecting to LINE Login...");
            liff.login();
          }
        } else {
          window.AppState.isLineLoggedIn = true;
          liff.getProfile().then(function(profile) {
            if (profile && profile.userId) {
              window.AppState.lineUserId = profile.userId;
              if (profile.displayName) {
                window.AppState.lineDisplayName = profile.displayName;
                window.AppState.requesterName = profile.displayName;
              }
            }
            resolve();
          }).catch(function(e) {
            console.warn("[App] getProfile error:", e);
            resolve();
          });
        }
      }).catch(function(err) {
        console.warn("[App] LIFF init warning:", err);
        resolve();
      });
    });
  },

  loginLine: function() {
    if (typeof liff !== "undefined") {
      console.log("[App] Initiating LINE Login...");
      liff.login({ redirectUri: window.location.href });
    } else {
      alert("ไม่พบ LINE SDK ในหน้านี้");
    }
  },

  logoutLine: function() {
    if (typeof liff !== "undefined" && liff.isLoggedIn && liff.isLoggedIn()) {
      if (confirm("ต้องการออกจากระบบ LINE ใช่หรือไม่?")) {
        liff.logout();
        window.location.reload();
      }
    }
  },

  /**
   * Master Data loader with 24-Hour LocalStorage Caching
   */
  loadMasterData: async function() {
    // Check LocalStorage cache first
    var cached = window.CacheManager.getMasterCache();
    if (cached) {
      window.AppState.masterData = cached;
      return;
    }

    // Cache miss or expired -> Fetch fresh from Cloudflare D1
    await this.syncMasterData(false);
  },

  /**
   * Syncs / Force-refreshes master data from Cloudflare D1
   */
  syncMasterData: async function(isManual) {
    var btnSync = document.getElementById("btn-sync-master");
    if (btnSync) btnSync.classList.add("spinning");

    try {
      var data = await window.ApiClient.request("/api/master");
      window.AppState.masterData = data;
      window.CacheManager.setMasterCache(data);

      if (isManual) {
        window.showToast("ซิงค์ข้อมูลล่าสุดสำเร็จ", "success");
        // Re-render current screen
        this.navigateTo(window.AppState.currentScreen);
      }
    } catch (err) {
      console.error("[App] Failed to fetch master data:", err);
      if (isManual) {
        window.showToast("❌ ซิงค์ข้อมูลไม่สำเร็จ: " + (err.message || "Error"), "error");
      }
    } finally {
      if (btnSync) btnSync.classList.remove("spinning");
    }
  },

  /**
   * Loads user profile and today_th from Cloudflare
   */
  loadUserProfile: async function() {
    try {
      var res = await window.ApiClient.request("/api/profile");
      if (res) {
        window.AppState.userProfile = res.profile;
        if (res.today_th) {
          window.AppState.selectedDate = res.today_th;
        }

        if (res.profile && res.profile.requester_name && res.profile.requester_name.trim() !== "") {
          window.AppState.requesterName = res.profile.requester_name;
          window.AppState.plateNo = res.profile.car_no || "";
        } else if (window.AppState.lineDisplayName) {
          window.AppState.requesterName = window.AppState.lineDisplayName;
        }

        window.CacheManager.setUserProfileCache(res.profile);
      }
    } catch (err) {
      console.warn("[App] Could not load profile, checking offline cache:", err);
      var cachedProfile = window.CacheManager.getUserProfileCache();
      if (cachedProfile) {
        window.AppState.userProfile = cachedProfile;
        window.AppState.requesterName = cachedProfile.requester_name || window.AppState.requesterName;
        window.AppState.plateNo = cachedProfile.car_no || "";
      }
    }
  },

  navigateTo: function(screenName) {
    window.AppState.currentScreen = screenName;
    var container = document.getElementById("app-screen-container");
    var stickyBar = document.getElementById("sticky-bar");

    if (screenName === "summary_list") {
      if (stickyBar) stickyBar.style.display = "none";
      window.DaySummaryListComponent.renderScreen(container);
    } else if (screenName === "trip_form") {
      if (stickyBar) stickyBar.style.display = "block";
      window.TripFormComponent.renderForm(container);
    }

    // Scroll smoothly to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

// Bootstrap on DOM ready
document.addEventListener("DOMContentLoaded", function() {
  window.App.init();
});
