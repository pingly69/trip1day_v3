/**
 * Route: GET /api/profile
 * Fetches user profile by line_uid and returns Thailand today date
 */
import { Env } from "../config";
import { getTodayTH } from "../utils/date";
import { buildSuccess, buildError } from "../utils/response";

export async function handleGetProfile(env: Env, userId: string): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      "SELECT line_uid, requester_name, car_no, group_car, emp_no FROM users_profile WHERE line_uid = ?"
    )
      .bind(userId)
      .first<{
        line_uid: string;
        requester_name: string;
        car_no: string;
        group_car: number;
        emp_no: string;
      }>();

    const todayTh = getTodayTH();

    if (!row) {
      return buildSuccess({
        exists: false,
        today_th: todayTh,
        profile: {
          line_uid: userId,
          requester_name: "",
          car_no: "",
          group_car: 1,
          emp_no: ""
        }
      });
    }

    return buildSuccess({
      exists: true,
      today_th: todayTh,
      profile: row
    });
  } catch (err) {
    console.error("[Profile] Error querying profile:", err);
    return buildError("SERVER_ERROR", "ไม่สามารถดึงข้อมูลโปรไฟล์ได้", 500);
  }
}
