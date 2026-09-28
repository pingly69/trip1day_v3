/**
 * Formatting & Client-side Validation Utilities
 * Trip1Day Mileage Reimbursement System (ver.3.0)
 */

window.ValidationUtil = {
  formatCurrency: function(num) {
    var val = parseFloat(num) || 0;
    return val.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  formatKm: function(num) {
    var val = parseFloat(num) || 0;
    return val.toLocaleString("th-TH", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  },

  /**
   * Validate entire form state before submitting
   */
  validateForm: function(state) {
    if (!state.requesterName || state.requesterName.trim() === "") {
      return { valid: false, field: "input-req-name", message: "กรุณาระบุชื่อผู้ขอเบิก" };
    }

    if (!state.selectedDate) {
      return { valid: false, field: "input-req-date", message: "กรุณาระบุวันที่เดินทาง" };
    }

    if (!state.selectedSiteId) {
      return { valid: false, field: "select-site-id", message: "กรุณาเลือก SITE งาน" };
    }

    if (!state.trips || state.trips.length === 0) {
      return { valid: false, message: "กรุณาเพิ่มเส้นทางการเดินทางอย่างน้อย 1 เส้นทาง" };
    }

    // Validate each trip
    for (var i = 0; i < state.trips.length; i++) {
      var t = state.trips[i];
      var idx = i + 1;

      if (t.type === "FIX" && !t.route_id) {
        return { valid: false, message: "เส้นทางที่ " + idx + ": กรุณาเลือกเส้นทางมาตรฐานในรายการ" };
      }

      if (!t.origin || t.origin.trim() === "") {
        return { valid: false, message: "เส้นทางที่ " + idx + ": กรุณาระบุจุดเริ่มต้น" };
      }

      if (!t.dest || t.dest.trim() === "") {
        return { valid: false, message: "เส้นทางที่ " + idx + ": กรุณาระบุปลายทาง" };
      }

      var km = parseFloat(t.km);
      if (isNaN(km) || km <= 0) {
        return { valid: false, message: "เส้นทางที่ " + idx + ": กรุณาระบุระยะทางที่มากกว่า 0 กม." };
      }
    }

    if (!state.travelPurpose || state.travelPurpose.trim() === "") {
      return { valid: false, field: "input-purpose", message: "กรุณาระบุวัตถุประสงค์การเดินทาง" };
    }

    if (!state.selectedApprover) {
      return { valid: false, field: "select-approver", message: "กรุณาเลือกผู้อนุมัติ" };
    }

    return { valid: true };
  }
};
