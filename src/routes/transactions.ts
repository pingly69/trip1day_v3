/**
 * Route: /api/transactions
 * Handles listing, creating, updating, and deleting transactions
 */
import { Env, ERROR_CODES } from "../config";
import { isValidDateFormat } from "../utils/date";
import { buildSuccess, buildError } from "../utils/response";
import {
  TripDetail,
  calculateTotalKm,
  getRateForDate,
  calculateNetTotal
} from "../services/rateCalc";
import {
  TransactionSubmitPayload,
  validateTransactionPayload
} from "../services/validation";

interface DbTransactionRow {
  transaction_id: string;
  req_name: string;
  req_line_user_id: string;
  req_date: string;
  plate_no: string;
  site_id: string;
  site_name: string;
  travel_purpose: string;
  image_url: string;
  total_km: number;
  toll_fee: number;
  park_fee: number;
  flat_rate_fee: number;
  net_total: number;
  approver: string;
  status: string;
  approve_datetime: string | null;
  trip_details: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/transactions?date=YYYY-MM-DD
 */
export async function handleGetTransactions(
  env: Env,
  userId: string,
  dateStr: string | null
): Promise<Response> {
  if (!dateStr || !isValidDateFormat(dateStr)) {
    return buildError(
      ERROR_CODES.VALIDATION_ERROR,
      "กรุณาระบุวันที่ที่ต้องการค้นหาในรูปแบบ YYYY-MM-DD"
    );
  }

  try {
    const result = await env.DB.prepare(
      `SELECT transaction_id, req_name, req_line_user_id, req_date,
              plate_no, site_id, site_name, travel_purpose, image_url,
              total_km, toll_fee, park_fee, flat_rate_fee, net_total,
              approver, status, approve_datetime, trip_details, created_at, updated_at
       FROM transactions
       WHERE req_date = ? AND req_line_user_id = ?
       ORDER BY created_at ASC`
    )
      .bind(dateStr, userId)
      .all<DbTransactionRow>();

    const items = (result.results || []).map((row) => {
      let parsedTrips: TripDetail[] = [];
      try {
        parsedTrips = JSON.parse(row.trip_details || "[]");
      } catch {
        parsedTrips = [];
      }

      return {
        transaction_id: row.transaction_id,
        req_name: row.req_name,
        req_line_user_id: row.req_line_user_id,
        req_date: row.req_date,
        plate_no: row.plate_no,
        site_id: row.site_id,
        site_name: row.site_name,
        travel_purpose: row.travel_purpose,
        image_url: row.image_url,
        total_km: row.total_km,
        toll_fee: row.toll_fee,
        park_fee: row.park_fee,
        flat_rate_fee: row.flat_rate_fee,
        net_total: row.net_total,
        approver: row.approver,
        status: row.status,
        approve_datetime: row.approve_datetime,
        trip_count: parsedTrips.length,
        trip_details: parsedTrips,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });

    return buildSuccess(items);
  } catch (err) {
    console.error("[Transactions] Query error:", err);
    return buildError(ERROR_CODES.SERVER_ERROR, "ไม่สามารถดึงข้อมูลรายการได้", 500);
  }
}

/**
 * POST /api/transactions
 */
export async function handleSubmitTransaction(
  env: Env,
  userId: string,
  request: Request
): Promise<Response> {
  let payload: TransactionSubmitPayload;
  try {
    payload = await request.json();
  } catch {
    return buildError(ERROR_CODES.PARSE_ERROR, "รูปแบบ JSON ไม่ถูกต้อง");
  }

  // 1. Validation
  const valResult = await validateTransactionPayload(env.DB, payload);
  if (!valResult.valid) {
    return buildError(ERROR_CODES.VALIDATION_ERROR, valResult.error || "ข้อมูลไม่ถูกต้อง");
  }

  try {
    // 2. Lookup user profile for group_car
    const userProfile = await env.DB.prepare(
      "SELECT group_car FROM users_profile WHERE line_uid = ?"
    )
      .bind(userId)
      .first<{ group_car: number }>();

    const userGroupCar = userProfile?.group_car || 1;

    // 3. Lookup rate for req_date
    const rate = await getRateForDate(env.DB, payload.req_date, userGroupCar);
    if (rate === null) {
      return buildError(
        ERROR_CODES.VALIDATION_ERROR,
        `ยังไม่มีการกำหนดอัตราค่าเดินทางสำหรับวันที่ ${payload.req_date}`
      );
    }

    // 4. Lookup flat_rate fee from config
    let flatRateAmount = 150;
    const configRow = await env.DB.prepare(
      "SELECT value FROM master_config WHERE key = 'flat_rate' OR key = 'FLAT_RATE_FEE'"
    ).first<{ value: string }>();

    if (configRow && !isNaN(Number(configRow.value))) {
      flatRateAmount = Number(configRow.value);
    }

    // 5. Lookup site_name for denormalization
    const siteRow = await env.DB.prepare(
      "SELECT site_name FROM master_site WHERE site_id = ?"
    )
      .bind(payload.site_id)
      .first<{ site_name: string }>();

    const siteName = siteRow?.site_name || "";

    // 6. Recalculate totals on server
    const totalKm = calculateTotalKm(payload.trip_details);
    const tollFee = Number(payload.toll_fee) || 0;
    const parkFee = Number(payload.park_fee) || 0;
    const flatRateFee = payload.use_flat_rate ? flatRateAmount : 0;
    const netTotal = calculateNetTotal(totalKm, rate, tollFee, parkFee, flatRateFee);
    const tripsJson = JSON.stringify(payload.trip_details);
    const plateNo = (payload.plate_no || "").trim();

    const isUpdate = !!payload.transaction_id;
    let finalTxId = payload.transaction_id;

    if (isUpdate) {
      // 7a. Handle UPDATE
      const existing = await env.DB.prepare(
        "SELECT transaction_id, req_line_user_id, status FROM transactions WHERE transaction_id = ?"
      )
        .bind(payload.transaction_id)
        .first<{ transaction_id: string; req_line_user_id: string; status: string }>();

      if (!existing) {
        return buildError(ERROR_CODES.NOT_FOUND, "ไม่พบรายการที่ต้องการแก้ไข", 404);
      }

      if (existing.req_line_user_id !== userId) {
        return buildError(ERROR_CODES.FORBIDDEN, "ท่านไม่มีสิทธิ์แก้ไขรายการของผู้อื่น", 403);
      }

      if (existing.status === "APPROVED") {
        return buildError(
          ERROR_CODES.LOCKED_TRANSACTION,
          "รายการนี้ได้รับการอนุมัติแล้ว ห้ามแก้ไขโดยเด็ดขาด"
        );
      }

      // Update existing record
      await env.DB.prepare(
        `UPDATE transactions SET
          req_name = ?,
          plate_no = ?,
          travel_purpose = ?,
          image_url = ?,
          total_km = ?,
          toll_fee = ?,
          park_fee = ?,
          flat_rate_fee = ?,
          net_total = ?,
          approver = ?,
          status = 'PENDING',
          trip_details = ?,
          updated_at = datetime('now', '+7 hours')
        WHERE transaction_id = ? AND req_line_user_id = ?`
      )
        .bind(
          payload.req_name.trim(),
          plateNo,
          payload.travel_purpose.trim(),
          payload.image_url || "",
          totalKm,
          tollFee,
          parkFee,
          flatRateFee,
          netTotal,
          payload.approver.trim(),
          tripsJson,
          payload.transaction_id,
          userId
        )
        .run();
    } else {
      // 7b. Handle INSERT (Check duplicate: 1 user + 1 date + 1 site)
      const dup = await env.DB.prepare(
        "SELECT transaction_id FROM transactions WHERE req_date = ? AND req_line_user_id = ? AND site_id = ?"
      )
        .bind(payload.req_date, userId, payload.site_id)
        .first<{ transaction_id: string }>();

      if (dup) {
        return buildError(
          ERROR_CODES.DUPLICATE_SITE_RECORD,
          "ท่านได้บันทึกรายการสำหรับ SITE งานนี้ในวันที่เลือกไว้แล้ว ไม่สามารถบันทึกซ้ำได้"
        );
      }

      finalTxId = `TX-${crypto.randomUUID()}`;

      await env.DB.prepare(
        `INSERT INTO transactions (
          transaction_id, req_name, req_line_user_id, req_date,
          plate_no, site_id, site_name, travel_purpose, image_url,
          total_km, toll_fee, park_fee, flat_rate_fee, net_total,
          approver, status, approve_datetime, trip_details, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, 'PENDING', NULL, ?, datetime('now', '+7 hours'), datetime('now', '+7 hours')
        )`
      )
        .bind(
          finalTxId,
          payload.req_name.trim(),
          userId,
          payload.req_date,
          plateNo,
          payload.site_id,
          siteName,
          payload.travel_purpose.trim(),
          payload.image_url || "",
          totalKm,
          tollFee,
          parkFee,
          flatRateFee,
          netTotal,
          payload.approver.trim(),
          tripsJson
        )
        .run();
    }

    // 8. Seamless Auto-Register or Update Profile
    if (!userProfile) {
      await env.DB.prepare(
        `INSERT INTO users_profile (line_uid, requester_name, car_no, group_car, emp_no, created_at, updated_at)
         VALUES (?, ?, ?, 1, '', datetime('now', '+7 hours'), datetime('now', '+7 hours'))`
      )
        .bind(userId, payload.req_name.trim(), plateNo)
        .run();
    } else {
      await env.DB.prepare(
        `UPDATE users_profile
         SET car_no = ?, requester_name = ?, updated_at = datetime('now', '+7 hours')
         WHERE line_uid = ?`
      )
        .bind(plateNo, payload.req_name.trim(), userId)
        .run();
    }

    return buildSuccess({
      transaction_id: finalTxId,
      total_km: totalKm,
      net_total: netTotal,
      status: "PENDING",
      message: isUpdate ? "อัปเดตรายการเรียบร้อยแล้ว" : "บันทึกรายการเบิกสำเร็จ"
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("[Transactions] Submit error:", err);
    if (error && error.message && error.message.includes("UNIQUE constraint failed")) {
      return buildError(
        ERROR_CODES.DUPLICATE_SITE_RECORD,
        "ท่านได้บันทึกรายการสำหรับ SITE งานนี้ในวันที่เลือกไว้แล้ว"
      );
    }
    return buildError(ERROR_CODES.SERVER_ERROR, "เกิดข้อผิดพลาดในการบันทึกข้อมูล", 500);
  }
}

/**
 * DELETE /api/transactions/:id
 */
export async function handleDeleteTransaction(
  env: Env,
  userId: string,
  transactionId: string
): Promise<Response> {
  if (!transactionId) {
    return buildError(ERROR_CODES.VALIDATION_ERROR, "กรุณาระบุรหัสรายการที่ต้องการลบ");
  }

  try {
    const existing = await env.DB.prepare(
      "SELECT transaction_id, req_line_user_id, status FROM transactions WHERE transaction_id = ?"
    )
      .bind(transactionId)
      .first<{ transaction_id: string; req_line_user_id: string; status: string }>();

    if (!existing) {
      return buildError(ERROR_CODES.NOT_FOUND, "ไม่พบรายการที่ต้องการลบ", 404);
    }

    if (existing.req_line_user_id !== userId) {
      return buildError(ERROR_CODES.FORBIDDEN, "ท่านไม่มีสิทธิ์ลบรายการของผู้อื่น", 403);
    }

    if (existing.status === "APPROVED") {
      return buildError(
        ERROR_CODES.LOCKED_TRANSACTION,
        "รายการนี้ได้รับการอนุมัติแล้ว ห้ามลบโดยเด็ดขาด"
      );
    }

    await env.DB.prepare(
      "DELETE FROM transactions WHERE transaction_id = ? AND req_line_user_id = ?"
    )
      .bind(transactionId, userId)
      .run();

    return buildSuccess({
      deleted: true,
      transaction_id: transactionId,
      message: "ลบรายการเรียบร้อยแล้ว"
    });
  } catch (err) {
    console.error("[Transactions] Delete error:", err);
    return buildError(ERROR_CODES.SERVER_ERROR, "เกิดข้อผิดพลาดในการลบรายการ", 500);
  }
}
