/**
 * API Client & Network Communications
 * Trip1Day Mileage Reimbursement System (ver.3.0)
 */

window.ApiClient = {
  TIMEOUT_MS: 15000,

  /**
   * Universal fetch wrapper with Auth token and timeout
   */
  request: async function(path, options) {
    options = options || {};
    var method = options.method || "GET";
    var body = options.body;
    var headers = options.headers || {};

    // 1. Resolve Authorization Token / Mock UID
    var token = null;
    if (typeof liff !== "undefined" && liff.isLoggedIn && liff.isLoggedIn()) {
      token = liff.getAccessToken();
    }

    if (token) {
      headers["Authorization"] = "Bearer " + token;
    } else if (window.APP_CONFIG && window.APP_CONFIG.ALLOW_DEV_MOCK) {
      // In dev mode outside LINE, attach Mock UID header
      var mockUid = (window.AppState && window.AppState.lineUserId) || window.APP_CONFIG.DEFAULT_MOCK_UID || "USER-LOCAL-TEST";
      headers["X-Mock-Line-Uid"] = mockUid;
      headers["Authorization"] = "Bearer MOCK_" + mockUid;
    }

    headers["Content-Type"] = "application/json; charset=utf-8";

    // 2. Setup Timeout AbortController
    var controller = null;
    var timeoutId = null;
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      timeoutId = setTimeout(function() {
        controller.abort();
      }, this.TIMEOUT_MS);
    }

    var baseUrl = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || "";
    var fetchUrl = baseUrl + path;

    var fetchConfig = {
      method: method,
      headers: headers,
      signal: controller ? controller.signal : undefined
    };

    if (body) {
      fetchConfig.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    try {
      var res = await fetch(fetchUrl, fetchConfig);
      if (timeoutId) clearTimeout(timeoutId);

      var json;
      try {
        json = await res.json();
      } catch (parseErr) {
        throw {
          error_code: "PARSE_ERROR",
          message: "เซิร์ฟเวอร์ส่งข้อมูลกลับมาไม่ถูกต้อง (HTTP " + res.status + ")"
        };
      }

      if (!res.ok || !json.success) {
        throw {
          error_code: json.error_code || "HTTP_" + res.status,
          message: json.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์"
        };
      }

      return json.data;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw {
          error_code: "TIMEOUT",
          message: "การเชื่อมต่อหมดเวลา (เกิน " + (this.TIMEOUT_MS / 1000) + " วินาที) กรุณาตรวจสอบอินเทอร์เน็ต"
        };
      }
      throw err;
    }
  }
};

/**
 * Toast Notification Utility
 */
window.showToast = function(message, type) {
  type = type || "info"; // success, error, info
  var container = document.getElementById("toast-container");
  if (!container) return;

  var toast = document.createElement("div");
  toast.className = "toast toast-" + type;

  var icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "⚠️";

  toast.innerHTML = "<span>" + icon + "</span><div>" + message + "</div>";
  container.appendChild(toast);

  setTimeout(function() {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
};
