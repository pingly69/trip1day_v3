/**
 * Day Summary List Component (ver.3.0)
 * Main Landing Screen for viewing and managing daily reimbursements
 */

window.DaySummaryListComponent = {
  renderScreen: function(containerEl) {
    var state = window.AppState;
    var currentDate = state.selectedDate || (state.masterData ? state.masterData.today_th : "");

    var html = '' +
    // LINE Login Banner for PC / Unconnected Mode
    (!state.isLineLoggedIn ? 
      '<div class="glass-card" style="background: rgba(6, 199, 85, 0.12); border: 1.5px solid #06c755; padding: 14px 18px; margin-bottom: 14px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">' +
        '<div>' +
          '<div style="font-weight: 700; color: #fff; font-size: 0.98rem; display: flex; align-items: center; gap: 8px;">' +
            '<span style="font-size: 1.25rem;">💬</span> เข้าสู่ระบบด้วย LINE' +
          '</div>' +
          '<div style="font-size: 0.85rem; color: #cbd5e1; margin-top: 3px;">' +
            'สแกน QR Code เพื่อเชื่อมต่อบัญชีจริงของคุณบน PC' +
          '</div>' +
        '</div>' +
        '<button type="button" onclick="window.App.loginLine()" style="background: #06c755; color: #fff; border: none; border-radius: 10px; padding: 9px 16px; font-weight: 700; font-size: 0.92rem; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 14px rgba(6, 199, 85, 0.4);">' +
          'ล็อกอิน LINE' +
        '</button>' +
      '</div>'
    : '') +

    // Top User Profile Pill
    '<div class="user-info-pill">' +
      '<div>' +
        '👤 <span class="user-name-highlight">' + (state.requesterName || (state.isLineLoggedIn ? "ผู้ใช้งาน" : "โหมดทดสอบ (PC)")) + '</span>' +
        (state.plateNo ? ' · 🚗 ' + state.plateNo : '') +
        (state.isLineLoggedIn ? ' · <span style="color:#34d399; font-size:0.8rem;">🟢 เชื่อมต่อแล้ว</span>' : '') +
      '</div>' +
      '<div style="display:flex; align-items:center; gap:8px;">' +
        (state.isLineLoggedIn ? '<a href="javascript:window.App.logoutLine()" style="color:#94a3b8; font-size:0.8rem; text-decoration:underline;">ออกจากระบบ</a>' : '') +
        '<div style="font-size:0.8rem; color:#94a3b8;">ver.3.0</div>' +
      '</div>' +
    '</div>' +

    // Date Picker & Sync Card
    '<div class="glass-card">' +
      '<div class="card-header-row">' +
        '<div class="card-header-title">📅 วันที่เดินทาง</div>' +
        '<button type="button" id="btn-sync-master" class="btn-sync" onclick="window.App.syncMasterData(true)">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>' +
            '<path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>' +
          '</svg>' +
          '<span>ซิงค์ข้อมูล</span>' +
        '</button>' +
      '</div>' +

      '<div class="form-group">' +
        '<input type="date" id="summary-date-picker" class="form-control" value="' + currentDate + '" ' +
          'onchange="DaySummaryListComponent.handleDateChange(this.value)">' +
      '</div>' +
    '</div>' +

    // Transactions Container
    '<div id="summary-cards-container">' +
      '<div style="text-align:center; padding: 30px;"><span class="spinner"></span> กำลังโหลดข้อมูล...</div>' +
    '</div>';

    containerEl.innerHTML = html;
    this.loadList(currentDate);
  },

  /**
   * Fetches transactions for the selected date from server
   * (Strictly filters by req_date and LINE UID to optimize D1 quota)
   */
  loadList: async function(dateStr) {
    var container = document.getElementById("summary-cards-container");
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding: 30px;"><span class="spinner"></span> กำลังโหลดข้อมูล...</div>';

    try {
      var items = await window.ApiClient.request("/api/transactions?date=" + encodeURIComponent(dateStr));
      window.AppState.dailyTransactions = items || [];

      if (!items || items.length === 0) {
        // Empty State
        container.innerHTML = '' +
        '<div class="glass-card" style="text-align: center; padding: 36px 20px;">' +
          '<div style="font-size: 3.2rem; margin-bottom: 12px;">🚗</div>' +
          '<div style="font-size: 1.25rem; font-weight: 700; color: #fff; margin-bottom: 8px;">ยังไม่มีรายการเบิกสำหรับวันนี้</div>' +
          '<div style="color: var(--text-muted); margin-bottom: 24px; font-size: 0.95rem;">' +
            'เริ่มต้นบันทึกการเดินทางประจำวันสำหรับ SITE งานของคุณ' +
          '</div>' +
          '<button type="button" class="btn btn-primary" onclick="DaySummaryListComponent.handleCreateNewRecord()">' +
            '➕ เริ่มบันทึกการเดินทาง' +
          '</button>' +
        '</div>';
      } else {
        // Transaction Cards List
        var html = '<div class="card-header-title" style="margin-left: 4px; margin-bottom: 12px;">รายการเบิกตาม SITE งาน (' + items.length + ')</div>';

        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var statusBadge = "";
          if (item.status === "APPROVED") {
            statusBadge = '<span class="badge badge-success">🟢 อนุมัติแล้ว</span>';
          } else if (item.status === "REJECTED") {
            statusBadge = '<span class="badge badge-danger">🔴 ปฏิเสธ</span>';
          } else {
            statusBadge = '<span class="badge badge-warning">🟡 รออนุมัติ</span>';
          }

          var deleteAction = "";
          if (item.status !== "APPROVED") {
            deleteAction = '' +
            '<div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: flex-end;">' +
              '<button type="button" onclick="event.stopPropagation(); DaySummaryListComponent.promptDeleteTransaction(\'' + item.transaction_id + '\')" ' +
                'style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 7px 14px; font-size: 0.9rem; font-weight: 600; border-radius: 8px; cursor: pointer;">' +
                '🗑️ ลบรายการนี้' +
              '</button>' +
            '</div>';
          }

          html += '' +
          '<div class="glass-card" style="cursor: pointer; transition: transform 0.15s ease;" onclick="DaySummaryListComponent.handleSelectRecord(\'' + item.transaction_id + '\')">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">' +
              '<div style="font-weight: 700; font-size: 1.15rem; color: #38bdf8;">📍 ' + (item.site_name || item.site_id) + '</div>' +
              statusBadge +
            '</div>' +
            '<div style="display: flex; justify-content: space-between; align-items: baseline; color: var(--text-muted); font-size: 0.98rem;">' +
              '<span>' + item.trip_count + ' เส้นทาง · ' + window.ValidationUtil.formatKm(item.total_km) + ' กม.</span>' +
              '<strong style="color: #fff; font-size: 1.25rem;">' + window.ValidationUtil.formatCurrency(item.net_total) + ' ฿</strong>' +
            '</div>' +
            deleteAction +
          '</div>';
        }

        html += '' +
        '<button type="button" class="btn btn-primary" style="margin-top: 10px;" onclick="DaySummaryListComponent.handleCreateNewRecord()">' +
          '➕ เพิ่ม Site ใหม่' +
        '</button>';

        container.innerHTML = html;
      }
    } catch (err) {
      console.error("Load list error:", err);
      container.innerHTML = '' +
      '<div class="glass-card" style="text-align: center; padding: 24px;">' +
        '<div style="color: #f87171; margin-bottom: 14px;">⚠️ เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + (err.message || "Error") + '</div>' +
        '<button type="button" class="btn btn-primary" onclick="DaySummaryListComponent.loadList(\'' + dateStr + '\')">' +
          '🔄 ลองใหม่อีกครั้ง' +
        '</button>' +
      '</div>';
    }
  },

  handleDateChange: function(newDate) {
    window.AppState.selectedDate = newDate;
    this.loadList(newDate);
  },

  handleCreateNewRecord: function() {
    window.AppState.resetFormState();
    window.App.navigateTo("trip_form");
  },

  /**
   * Directly opens the full record from the preloaded dailyTransactions array
   * Zero extra D1 queries!
   */
  handleSelectRecord: function(txId) {
    var items = window.AppState.dailyTransactions || [];
    var found = items.find(function(it) { return it.transaction_id === txId; });

    if (found) {
      window.AppState.loadTransactionDetailIntoState(found);
      window.App.navigateTo("trip_form");
    } else {
      window.showToast("ไม่พบข้อมูลรายการ", "error");
    }
  },

  promptDeleteTransaction: function(txId) {
    window.AppState.pendingDeleteTxId = txId;
    var modal = document.getElementById("modal-delete-tx");
    if (modal) modal.classList.add("active");
  },

  closeDeleteModal: function() {
    var modal = document.getElementById("modal-delete-tx");
    if (modal) modal.classList.remove("active");
    window.AppState.pendingDeleteTxId = null;
  },

  executeDeleteTransaction: async function() {
    var txId = window.AppState.pendingDeleteTxId;
    if (!txId) return;

    this.closeDeleteModal();
    var container = document.getElementById("summary-cards-container");
    if (container) {
      container.innerHTML = '<div style="text-align:center; padding: 30px;"><span class="spinner"></span> กำลังลบรายการ...</div>';
    }

    try {
      await window.ApiClient.request("/api/transactions/" + encodeURIComponent(txId), {
        method: "DELETE"
      });
      window.showToast("ลบรายการเรียบร้อยแล้ว", "success");
      this.loadList(window.AppState.selectedDate);
    } catch (err) {
      console.error("Delete error:", err);
      window.showToast("❌ ลบรายการไม่สำเร็จ: " + (err.message || "Error"), "error");
      this.loadList(window.AppState.selectedDate);
    }
  }
};
