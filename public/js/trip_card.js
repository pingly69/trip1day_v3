/**
 * Trip Card Component (ver.3.0)
 * Handles individual route items (Fix Route & Custom Route)
 */

window.TripCardComponent = {
  generateTripId: function() {
    return "t-" + Math.random().toString(36).substring(2, 8);
  },

  /**
   * Renders HTML for a single trip card
   */
  renderCardHtml: function(trip, index, totalTrips, routes, siteId, isEditLocked) {
    var tripId = trip.trip_id;
    var tripNo = index + 1;
    var isFix = trip.type === "FIX";
    var isRoundTrip = trip.trip_type === "ROUND_TRIP";

    // Filter routes belonging to the currently selected site_id
    var siteRoutes = [];
    if (siteId && routes) {
      siteRoutes = routes.filter(function(r) {
        return String(r.site_id) === String(siteId);
      });
    }

    // Build Route Options
    var routeOptions = '<option value="">-- เลือกเส้นทางเดินทาง --</option>';
    for (var i = 0; i < siteRoutes.length; i++) {
      var r = siteRoutes[i];
      var selected = (String(r.route_id) === String(trip.route_id)) ? "selected" : "";
      routeOptions += '<option value="' + r.route_id + '" ' + selected + '>' + r.route_name + ' (' + r.distance_km + ' กม.)</option>';
    }
    var customSelected = (!isFix) ? "selected" : "";
    routeOptions += '<option value="__CUSTOM__" ' + customSelected + '>📍 ระบุเส้นทางเอง (Custom)</option>';

    // Route Badge
    var tripTypeBadge = "";
    var customHint = "";
    if (isRoundTrip) {
      if (isFix) {
        tripTypeBadge = '<span class="badge badge-info">🔁 ไปกลับ ×2</span>';
      } else {
        tripTypeBadge = '<span class="badge badge-warning">🔁 ไปกลับ</span>';
        customHint = '<div class="hint-text" style="color:#fbbf24;">ℹ️ กรอกระยะทางรวมตามจริง (รวมขากลับด้วยหากมีการเดินทางไปกลับ)</div>';
      }
    }

    // Delete Button (Only for card 2 and up, and when not edit-locked)
    var deleteBtnHtml = "";
    if (totalTrips > 1 && !isEditLocked) {
      deleteBtnHtml = '<button type="button" class="btn-delete-trip" onclick="TripFormComponent.confirmRemoveTrip(\'' + tripId + '\')">' +
        '🗑️ ลบเส้นทาง' +
      '</button>';
    }

    return '' +
    '<div class="trip-card" id="trip-card-' + tripId + '">' +
      '<div class="trip-card-header">' +
        '<div class="trip-card-title">' +
          '<span>🚗 เส้นทางที่ ' + tripNo + '</span> ' + tripTypeBadge +
        '</div>' +
        deleteBtnHtml +
      '</div>' +

      // Select Route Combobox
      '<div class="form-group">' +
        '<label class="form-label">เลือกเส้นทาง</label>' +
        '<select class="form-control" ' + (isEditLocked || !siteId ? 'disabled' : '') + ' onchange="TripFormComponent.handleRouteChange(\'' + tripId + '\', this.value)">' +
          routeOptions +
        '</select>' +
        (!siteId ? '<div class="hint-text" style="color:#f87171;">⚠️ กรุณาเลือก SITE งานที่ด้านบนก่อน</div>' : '') +
      '</div>' +

      // Origin & Destination Inputs
      '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:14px;">' +
        '<div>' +
          '<label class="form-label">ต้นทาง ' + (isFix ? '🔒' : '') + '</label>' +
          '<input type="text" class="form-control" value="' + (trip.origin || '') + '" ' +
            (isFix || isEditLocked ? 'readonly' : '') + ' placeholder="จุดเริ่มต้น" ' +
            'oninput="TripFormComponent.handleTripFieldChange(\'' + tripId + '\', \'origin\', this.value)">' +
        '</div>' +
        '<div>' +
          '<label class="form-label">ปลายทาง ' + (isFix ? '🔒' : '') + '</label>' +
          '<input type="text" class="form-control" value="' + (trip.dest || '') + '" ' +
            (isFix || isEditLocked ? 'readonly' : '') + ' placeholder="จุดสิ้นสุด" ' +
            'oninput="TripFormComponent.handleTripFieldChange(\'' + tripId + '\', \'dest\', this.value)">' +
        '</div>' +
      '</div>' +

      // Distance KM & Trip Type Toggle
      '<div style="display:grid; grid-template-columns: 1.1fr 1.3fr; gap:12px; align-items:start;">' +
        '<div>' +
          '<label class="form-label">ระยะทาง (กม.) ' + (isFix ? '🔒' : '') + '</label>' +
          '<input type="number" step="0.1" inputmode="decimal" class="form-control" ' +
            'value="' + (trip.km !== undefined && trip.km !== null ? trip.km : '') + '" ' +
            (isFix || isEditLocked ? 'readonly' : '') + ' placeholder="0.0" ' +
            'oninput="TripFormComponent.handleTripKmChange(\'' + tripId + '\', this.value)">' +
        '</div>' +

        '<div>' +
          '<label class="form-label">ประเภทการเดินทาง</label>' +
          '<div class="segmented-control">' +
            '<button type="button" class="segmented-btn ' + (!isRoundTrip ? 'active' : '') + '" ' +
              (isEditLocked ? 'disabled' : '') + ' onclick="TripFormComponent.handleTripTypeToggle(\'' + tripId + '\', \'SINGLE\')">' +
              'เที่ยวเดียว' +
            '</button>' +
            '<button type="button" class="segmented-btn ' + (isRoundTrip ? 'active' : '') + '" ' +
              (isEditLocked ? 'disabled' : '') + ' onclick="TripFormComponent.handleTripTypeToggle(\'' + tripId + '\', \'ROUND_TRIP\')">' +
              'ไปกลับ' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      customHint +
    '</div>';
  }
};
