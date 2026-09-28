/**
 * Validation service for transaction submission
 */
import { isValidDateFormat } from "../utils/date";
import { TripDetail } from "./rateCalc";

export interface TransactionSubmitPayload {
  transaction_id?: string | null;
  req_name: string;
  req_date: string;
  plate_no?: string;
  site_id: string;
  travel_purpose: string;
  image_url?: string;
  toll_fee?: number;
  park_fee?: number;
  use_flat_rate?: boolean;
  approver: string;
  trip_details: TripDetail[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export async function validateTransactionPayload(
  db: D1Database,
  payload: TransactionSubmitPayload,
  minTrips = 1,
  maxTrips = 10
): Promise<ValidationResult> {
  if (!payload) {
    return { valid: false, error: "ไม่พบข้อมูลที่ส่งเข้ามา (Empty payload)" };
  }

  // 1. Validate basic fields
  if (!payload.req_name || typeof payload.req_name !== "string" || payload.req_name.trim() === "") {
    return { valid: false, error: "กรุณาระบุชื่อผู้ขอเบิก" };
  }

  if (!payload.req_date || !isValidDateFormat(payload.req_date)) {
    return { valid: false, error: "รูปแบบวันที่เดินทางไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)" };
  }

  if (!payload.site_id || typeof payload.site_id !== "string" || payload.site_id.trim() === "") {
    return { valid: false, error: "กรุณาเลือก SITE งาน" };
  }

  if (!payload.travel_purpose || typeof payload.travel_purpose !== "string" || payload.travel_purpose.trim() === "") {
    return { valid: false, error: "กรุณาระบุวัตถุประสงค์การเดินทาง" };
  }

  if (!payload.approver || typeof payload.approver !== "string" || payload.approver.trim() === "") {
    return { valid: false, error: "กรุณาเลือกผู้อนุมัติ" };
  }

  // 2. Validate site_id exists & active
  const site = await db
    .prepare("SELECT site_id, site_name FROM master_site WHERE site_id = ? AND active = 1")
    .bind(payload.site_id)
    .first<{ site_id: string; site_name: string }>();

  if (!site) {
    return { valid: false, error: "SITE งานที่เลือกไม่ถูกต้อง หรือถูกปิดการใช้งานแล้ว" };
  }

  // 3. Validate approver exists & active
  const approverRow = await db
    .prepare("SELECT id FROM approve_users WHERE approve_request = ? AND active = 1")
    .bind(payload.approver)
    .first();

  if (!approverRow) {
    return { valid: false, error: "ผู้อนุมัติที่เลือกไม่ถูกต้อง หรือถูกปิดการใช้งานแล้ว" };
  }

  // 4. Validate trip count
  const trips = payload.trip_details;
  if (!Array.isArray(trips) || trips.length < minTrips || trips.length > maxTrips) {
    return { valid: false, error: `จำนวนเส้นทางต้องอยู่ระหว่าง ${minTrips} ถึง ${maxTrips} เส้นทางต่อวัน` };
  }

  // 5. Validate each trip
  for (let i = 0; i < trips.length; i++) {
    const t = trips[i];
    const tripIndex = i + 1;

    if (!t) {
      return { valid: false, error: `ข้อมูลเส้นทางที่ ${tripIndex} ไม่ถูกต้อง` };
    }

    if (t.trip_type !== "SINGLE" && t.trip_type !== "ROUND_TRIP") {
      return { valid: false, error: `เส้นทางที่ ${tripIndex}: กรุณาระบุประเภทการเดินทางเป็น 'เที่ยวเดียว' หรือ 'ไปกลับ'` };
    }

    if (!t.origin || typeof t.origin !== "string" || t.origin.trim() === "") {
      return { valid: false, error: `เส้นทางที่ ${tripIndex}: กรุณาระบุจุดเริ่มต้น` };
    }

    if (!t.dest || typeof t.dest !== "string" || t.dest.trim() === "") {
      return { valid: false, error: `เส้นทางที่ ${tripIndex}: กรุณาระบุปลายทาง` };
    }

    const km = Number(t.km);
    if (isNaN(km) || km <= 0) {
      return { valid: false, error: `เส้นทางที่ ${tripIndex}: กรุณาระบุระยะทางที่มากกว่า 0 กม.` };
    }

    // If FIX route, verify route_id belongs to selected site_id
    if (t.type === "FIX") {
      if (!t.route_id) {
        return { valid: false, error: `เส้นทางที่ ${tripIndex}: กรุณาเลือกเส้นทางมาตรฐาน` };
      }

      const routeRow = await db
        .prepare("SELECT route_id FROM master_routes WHERE route_id = ? AND site_id = ? AND active = 1")
        .bind(t.route_id, payload.site_id)
        .first();

      if (!routeRow) {
        return { valid: false, error: `เส้นทางที่ ${tripIndex}: เส้นทางมาตรฐานไม่ตรงกับ SITE งานที่เลือก` };
      }
    }
  }

  // 6. Validate fees
  if (payload.toll_fee !== undefined && (isNaN(Number(payload.toll_fee)) || Number(payload.toll_fee) < 0)) {
    return { valid: false, error: "ค่าทางด่วนต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0" };
  }

  if (payload.park_fee !== undefined && (isNaN(Number(payload.park_fee)) || Number(payload.park_fee) < 0)) {
    return { valid: false, error: "ค่าที่จอดรถต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0" };
  }

  return { valid: true };
}
