/**
 * Reimbursement Form & Calculation Component (ver.3.0)
 * Trip1Day Mileage Reimbursement System
 */

window.TripFormComponent = {
  renderForm: function(containerEl) {
    var state = window.AppState;
    var master = state.masterData || {};
    var isEditLocked = state.currentTransactionStatus === "APPROVED";

    var sites = master.sites || [];
    var approvers = master.approvers || [];

    // 1. Build Site Dropdown Options
    var siteOptions = '<option value="">-- เลือก SITE งาน --</option>';
    for (var i = 0; i < sites.length; i++) {
      var s = sites[i];
      var selected = (s.site_id === state.selectedSiteId) ? "selected" : "";
      siteOptions += '<option value="' + s.site_id + '" ' + selected + '>' + s.site_name + '</option>';
    }

    // 2. Build Approver Dropdown Options
    var approverOptions = '<option value="">-- เลือกผู้อนุมัติ --</option>';
    for (var j = 0; j < approvers.length; j++) {
      var appName = approvers[j];
      var selectedApp = (appName === state.selectedApprover) ? "selected" : "";
      approverOptions += '<option value="' + appName + '" ' + selectedApp + '>' + appName + '</option>';
    }

    var flatRateAmount = (master.config && master.config.flat_rate) || 150;

    var html = '' +
    // Top Card: Basic Information
    '<div class="glass-card">' +
      '<div class="card-header-title">' +
        '<span>📋 บันทึกเบิกค่าเดินทาง ver.3.0</span>' +
      '</div>' +

      (isEditLocked ? 
        '<div class="badge badge-success" style="width: 100%; justify-content: center; padding: 12px; margin-bottom: 16px; font-size: 1rem;">' +
          '🔒 รายการนี้ได้รับการอนุมัติแล้ว (Read-Only)' +
        '</div>' : '') +

      '<div class="form-group">' +
        '<label class="form-label">ชื่อผู้ขอเบิก <span style="color:#ef4444;">*</span></label>' +
        '<input type="text" id="input-req-name" class="form-control" value="' + (state.requesterName || '') + '" ' +
          (isEditLocked ? 'readonly' : '') + ' placeholder="ระบุชื่อ-นามสกุล">' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">เลขทะเบียนรถ</label>' +
        '<input type="text" id="input-plate-no" class="form-control" value="' + (state.plateNo || '') + '" ' +
          (isEditLocked ? 'readonly' : '') + ' placeholder="เช่น กข-1234 กทม">' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">วันที่เดินทาง <span style="color:#ef4444;">*</span> ' +
          (state.currentTxId ? '🔒 (ล็อกหลังบันทึก)' : '') + '</label>' +
        '<input type="date" id="input-req-date" class="form-control" value="' + (state.selectedDate || master.today_th || '') + '" ' +
          (state.currentTxId || isEditLocked ? 'disabled readonly' : '') + ' onchange="TripFormComponent.handleDateChange(this.value)">' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">SITE งาน <span style="color:#ef4444;">*</span> ' +
          (state.currentTxId ? '🔒 (ล็อกหลังบันทึก)' : '') + '</label>' +
        '<select id="select-site-id" class="form-control" ' +
          (state.currentTxId || isEditLocked ? 'disabled' : '') + ' onchange="TripFormComponent.handleSiteChange(this.value)">' +
          siteOptions +
        '</select>' +
      '</div>' +
    '</div>' +

    // Dynamic Trip Cards Container
    '<div id="trip-cards-container"></div>' +

    // Add Trip Card Button
    (!isEditLocked ? 
      '<div style="margin-bottom: 18px;">' +
        '<button type="button" id="btn-add-trip" class="btn btn-secondary" onclick="TripFormComponent.handleAddTripCard()">' +
          '➕ เพิ่มเส้นทางการเดินทาง' +
        '</button>' +
        '<div id="max-trips-hint" class="hint-text" style="text-align: center; display: none; color:#f59e0b;">สูงสุด 10 เส้นทางต่อวัน</div>' +
      '</div>' : '') +

    // General Details & Fees Card
    '<div class="glass-card">' +
      '<div class="form-group">' +
        '<label class="form-label">วัตถุประสงค์การเดินทาง <span style="color:#ef4444;">*</span></label>' +
        '<input type="text" id="input-purpose" class="form-control" value="' + (state.travelPurpose || '') + '" ' +
          (isEditLocked ? 'readonly' : '') + ' placeholder="เช่น ติดต่อลูกค้า / ซ่อมบำรุง">' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">ค่าทางด่วน (บาท)</label>' +
        '<input type="number" step="1" inputmode="decimal" id="input-toll-fee" class="form-control" value="' + (state.tollFee || '') + '" ' +
          (isEditLocked ? 'readonly' : '') + ' placeholder="0" oninput="TripFormComponent.handleFeeChange()">' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">ค่าที่จอดรถ (บาท)</label>' +
        '<input type="number" step="1" inputmode="decimal" id="input-park-fee" class="form-control" value="' + (state.parkFee || '') + '" ' +
          (isEditLocked ? 'readonly' : '') + ' placeholder="0" oninput="TripFormComponent.handleFeeChange()">' +
      '</div>' +

      // Flat Rate Toggle
      '<div class="form-group" style="display:flex; align-items:center; justify-content:space-between; background:rgba(15,23,42,0.6); padding:12px 16px; border-radius:12px; border:1px solid var(--card-border);">' +
        '<div>' +
          '<div style="font-weight:600; font-size:1rem; color:#fff;">ค่ารถ (' + flatRateAmount + ' บาท)</div>' +
          '<div class="hint-text">เปิดเมื่อมีการใช้รถส่วนตัวเหมาเบิกประจำวัน</div>' +
        '</div>' +
        '<input type="checkbox" id="chk-flat-rate" style="width:24px; height:24px; cursor:pointer;" ' +
          (state.flatRateFee > 0 ? 'checked' : '') + ' ' + (isEditLocked ? 'disabled' : '') + ' onchange="TripFormComponent.handleFeeChange()">' +
      '</div>' +

      '<div class="form-group" style="margin-top:16px;">' +
        '<label class="form-label">ส่งขออนุมัติไปยัง <span style="color:#ef4444;">*</span></label>' +
        '<select id="select-approver" class="form-control" ' + (isEditLocked ? 'disabled' : '') + '>' +
          approverOptions +
        '</select>' +
      '</div>' +
    '</div>' +

    // Blue Summary Breakdown Box
    '<div class="summary-box">' +
      '<div class="summary-row"><span>ระยะทางรวม:</span><strong id="summary-total-km">0.0 กม.</strong></div>' +
      '<div class="summary-row"><span>อัตราเบิก:</span><strong id="summary-rate">0.00 บาท/กม.</strong></div>' +
      '<div class="summary-row"><span>ค่ารถ:</span><strong id="summary-flat-fee">0.00 บาท</strong></div>' +
      '<div class="summary-row total-net"><span>ยอดเบิกสุทธิ:</span><strong id="summary-net-total">0.00 บาท</strong></div>' +
    '</div>' +

    // Back button
    '<button type="button" class="btn btn-secondary" style="margin-top:10px;" onclick="window.App.navigateTo(\'summary_list\')">' +
      '⬅️ ย้อนกลับไปหน้ารายการประจำวัน' +
    '</button>';

    containerEl.innerHTML = html;
    this.renderTripsList();
    this.updateSummary();
  },

  renderTripsList: function() {
    var container = document.getElementById("trip-cards-container");
    if (!container) return;

    var state = window.AppState;
    var trips = state.trips || [];
    var master = state.masterData || {};
    var routes = master.routes || [];
    var siteId = state.selectedSiteId;
    var isEditLocked = state.currentTransactionStatus === "APPROVED";

    var html = "";
    for (var i = 0; i < trips.length; i++) {
      html += window.TripCardComponent.renderCardHtml(trips[i], i, trips.length, routes, siteId, isEditLocked);
    }
    container.innerHTML = html;

    // Check Max Trips
    var maxTrips = (master.config && master.config.max_trips) || 10;
    var btnAdd = document.getElementById("btn-add-trip");
    var hintMax = document.getElementById("max-trips-hint");

    if (btnAdd && hintMax) {
      if (trips.length >= maxTrips) {
        btnAdd.disabled = true;
        hintMax.style.display = "block";
      } else {
        btnAdd.disabled = false;
        hintMax.style.display = "none";
      }
    }
  },

  handleAddTripCard: function() {
    var state = window.AppState;
    var maxTrips = (state.masterData && state.masterData.config && state.masterData.config.max_trips) || 10;
    if (state.trips.length >= maxTrips) return;

    state.trips.push({
      trip_id: window.TripCardComponent.generateTripId(),
      trip_no: state.trips.length + 1,
      type: "CUSTOM",
      trip_type: "SINGLE",
      route_id: null,
      route_name: "ระบุเอง",
      origin: "",
      dest: "",
      km: ""
    });

    this.renderTripsList();
    this.updateSummary();
  },

  confirmRemoveTrip: function(tripId) {
    if (window.AppState.trips.length <= 1) return;
    if (confirm("ต้องการลบเส้นทางนี้หรือไม่?")) {
      window.AppState.removeTrip(tripId);
      this.renderTripsList();
      this.updateSummary();
    }
  },

  handleSiteChange: function(newSiteId) {
    var state = window.AppState;
    var hasFixTrips = state.trips.some(function(t) { return t.type === "FIX"; });

    if (hasFixTrips && state.selectedSiteId && state.selectedSiteId !== newSiteId) {
      if (confirm("การเปลี่ยน SITE งานจะล้างข้อมูลเส้นทางมาตรฐานเดิม คุณต้องการเปลี่ยนหรือไม่?")) {
        // Reset FIX trips to CUSTOM
        state.trips.forEach(function(t) {
          if (t.type === "FIX") {
            t.type = "CUSTOM";
            t.route_id = null;
            t.route_name = "ระบุเอง";
            t.origin = "";
            t.dest = "";
            t.km = "";
          }
        });
        state.selectedSiteId = newSiteId;
      } else {
        // Revert dropdown
        document.getElementById("select-site-id").value = state.selectedSiteId;
        return;
      }
    } else {
      state.selectedSiteId = newSiteId;
    }

    this.renderTripsList();
    this.updateSummary();
  },

  handleRouteChange: function(tripId, val) {
    var trip = window.AppState.findTrip(tripId);
    if (!trip) return;

    if (val === "__CUSTOM__" || !val) {
      trip.type = "CUSTOM";
      trip.route_id = null;
      trip.route_name = "ระบุเอง";
      trip.origin = "";
      trip.dest = "";
      trip.km = "";
    } else {
      var route = window.AppState.findRoute(val);
      if (route) {
        trip.type = "FIX";
        trip.route_id = route.route_id;
        trip.route_name = route.route_name;
        trip.origin = route.origin;
        trip.dest = route.destination;
        trip.km = route.distance_km;
      }
    }

    this.renderTripsList();
    this.updateSummary();
  },

  handleTripFieldChange: function(tripId, field, val) {
    var trip = window.AppState.findTrip(tripId);
    if (trip) trip[field] = val;
  },

  handleTripKmChange: function(tripId, val) {
    var trip = window.AppState.findTrip(tripId);
    if (trip) {
      trip.km = val;
      this.updateSummary();
    }
  },

  handleTripTypeToggle: function(tripId, type) {
    var trip = window.AppState.findTrip(tripId);
    if (trip) {
      trip.trip_type = type;
      this.renderTripsList();
      this.updateSummary();
    }
  },

  handleDateChange: function(newDate) {
    window.AppState.selectedDate = newDate;
    this.updateSummary();
  },

  handleFeeChange: function() {
    this.updateSummary();
  },

  /**
   * Recalculates effective KM, Rate, and Net Total on client for immediate feedback
   */
  updateSummary: function() {
    var state = window.AppState;
    var master = state.masterData || {};

    // 1. Calculate Total Effective KM
    var totalKm = 0;
    for (var i = 0; i < state.trips.length; i++) {
      var t = state.trips[i];
      var km = parseFloat(t.km) || 0;
      if (t.type === "FIX" && t.trip_type === "ROUND_TRIP") {
        totalKm += km * 2;
      } else {
        totalKm += km;
      }
    }

    // 2. Lookup Rate for Selected Date
    var reqDate = state.selectedDate || master.today_th || "";
    var userGroupCar = (state.userProfile && state.userProfile.group_car) || 1;
    var rate = 0;

    var rates = master.rates || [];
    for (var j = 0; j < rates.length; j++) {
      if (rates[j].dt_date <= reqDate) {
        rate = userGroupCar === 2 ? rates[j].group_car2 : rates[j].group_car1;
        break;
      }
    }

    // 3. Read Fees
    var tollEl = document.getElementById("input-toll-fee");
    var parkEl = document.getElementById("input-park-fee");
    var flatEl = document.getElementById("chk-flat-rate");

    var tollFee = tollEl ? (parseFloat(tollEl.value) || 0) : state.tollFee;
    var parkFee = parkEl ? (parseFloat(parkEl.value) || 0) : state.parkFee;
    var flatRateVal = (master.config && master.config.flat_rate) || 150;
    var flatRateFee = (flatEl && flatEl.checked) ? flatRateVal : 0;

    var netTotal = (totalKm * rate) + tollFee + parkFee + flatRateFee;

    // 4. Update UI Elements
    var elKm = document.getElementById("summary-total-km");
    var elRate = document.getElementById("summary-rate");
    var elFlat = document.getElementById("summary-flat-fee");
    var elNet = document.getElementById("summary-net-total");

    if (elKm) elKm.textContent = window.ValidationUtil.formatKm(totalKm) + " กม.";
    if (elRate) elRate.textContent = window.ValidationUtil.formatCurrency(rate) + " ฿/กม.";
    if (elFlat) elFlat.textContent = window.ValidationUtil.formatCurrency(flatRateFee) + " บาท";
    if (elNet) elNet.textContent = window.ValidationUtil.formatCurrency(netTotal) + " บาท";

    // 5. Update Sticky Bar Elements
    var stickyNet = document.getElementById("sticky-net-total");
    var stickyKm = document.getElementById("sticky-total-km");
    if (stickyNet) stickyNet.textContent = window.ValidationUtil.formatCurrency(netTotal) + " ฿";
    if (stickyKm) stickyKm.textContent = window.ValidationUtil.formatKm(totalKm) + " กม.";
  },

  /**
   * Submit transaction to Cloudflare Workers API
   */
  submitForm: async function() {
    var state = window.AppState;
    if (state.currentTransactionStatus === "APPROVED") {
      window.showToast("รายการนี้ได้รับการอนุมัติแล้ว ไม่สามารถแก้ไขได้", "error");
      return;
    }

    // Pull current values from DOM
    var nameEl = document.getElementById("input-req-name");
    var plateEl = document.getElementById("input-plate-no");
    var dateEl = document.getElementById("input-req-date");
    var siteEl = document.getElementById("select-site-id");
    var purposeEl = document.getElementById("input-purpose");
    var tollEl = document.getElementById("input-toll-fee");
    var parkEl = document.getElementById("input-park-fee");
    var flatEl = document.getElementById("chk-flat-rate");
    var approverEl = document.getElementById("select-approver");

    if (nameEl) state.requesterName = nameEl.value.trim();
    if (plateEl) state.plateNo = plateEl.value.trim();
    if (dateEl) state.selectedDate = dateEl.value;
    if (siteEl) state.selectedSiteId = siteEl.value;
    if (purposeEl) state.travelPurpose = purposeEl.value.trim();
    if (tollEl) state.tollFee = parseFloat(tollEl.value) || 0;
    if (parkEl) state.parkFee = parseFloat(parkEl.value) || 0;
    if (flatEl) state.useFlatRate = flatEl.checked;
    if (approverEl) state.selectedApprover = approverEl.value;

    // Validate
    var val = window.ValidationUtil.validateForm(state);
    if (!val.valid) {
      window.showToast(val.message, "error");
      if (val.field) {
        var el = document.getElementById(val.field);
        if (el) el.focus();
      }
      return;
    }

    // Construct Payload
    var payload = {
      transaction_id: state.currentTxId || null,
      req_name: state.requesterName,
      req_date: state.selectedDate,
      plate_no: state.plateNo,
      site_id: state.selectedSiteId,
      travel_purpose: state.travelPurpose,
      image_url: "",
      toll_fee: state.tollFee,
      park_fee: state.parkFee,
      use_flat_rate: !!state.useFlatRate,
      approver: state.selectedApprover,
      trip_details: state.trips.map(function(t, idx) {
        return {
          trip_id: t.trip_id,
          trip_no: idx + 1,
          type: t.type,
          trip_type: t.trip_type,
          route_id: t.route_id || null,
          route_name: t.route_name || "ระบุเอง",
          origin: t.origin,
          dest: t.dest,
          km: parseFloat(t.km) || 0
        };
      })
    };

    var btnSubmit = document.getElementById("btn-submit-tx");
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span class="spinner"></span> กำลังบันทึก...';
    }

    try {
      var result = await window.ApiClient.request("/api/transactions", {
        method: "POST",
        body: payload
      });

      window.showToast(result.message || "บันทึกข้อมูลสำเร็จ", "success");
      // Navigate back to summary list
      window.App.navigateTo("summary_list");
    } catch (err) {
      console.error("Submit error:", err);
      window.showToast("❌ ไม่สามารถบันทึกได้: " + (err.message || "Error"), "error");
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '💾 บันทึกขอเบิก';
      }
    }
  }
};
