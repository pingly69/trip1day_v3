/**
 * Route: GET /api/master
 * Fetches all active master tables for 24-Hour client caching
 */
import { Env } from "../config";
import { buildSuccess, buildError } from "../utils/response";

export async function handleGetMasterData(env: Env): Promise<Response> {
  try {
    const [sitesRes, routesRes, approversRes, ratesRes, configRes] = await Promise.all([
      env.DB.prepare(
        "SELECT site_id, site_name FROM master_site WHERE active = 1 ORDER BY site_name ASC"
      ).all<{ site_id: string; site_name: string }>(),

      env.DB.prepare(
        "SELECT route_id, site_id, route_name, origin, destination, distance_km FROM master_routes WHERE active = 1 ORDER BY route_name ASC"
      ).all<{
        route_id: string;
        site_id: string;
        route_name: string;
        origin: string;
        destination: string;
        distance_km: number;
      }>(),

      env.DB.prepare(
        "SELECT id, approve_request, line_uid FROM approve_users WHERE active = 1 ORDER BY approve_request ASC"
      ).all<{ id: number; approve_request: string; line_uid: string }>(),

      env.DB.prepare(
        "SELECT dt_date, group_car1, group_car2 FROM rate_car ORDER BY dt_date DESC"
      ).all<{ dt_date: string; group_car1: number; group_car2: number }>(),

      env.DB.prepare("SELECT key, value FROM master_config").all<{
        key: string;
        value: string;
      }>()
    ]);

    // Build key-value config map
    const configMap: Record<string, string> = {};
    for (const item of configRes.results) {
      configMap[item.key.toLowerCase()] = item.value;
      configMap[item.key.toUpperCase()] = item.value;
    }

    return buildSuccess({
      sites: sitesRes.results,
      routes: routesRes.results,
      approvers: approversRes.results.map((a) => a.approve_request),
      rates: ratesRes.results,
      config: {
        flat_rate: Number(configMap["flat_rate"] || configMap["FLAT_RATE_FEE"] || 150),
        max_trips: Number(configMap["max_trips_per_day"] || configMap["MAX_TRIPS_PER_DAY"] || 10),
        min_trips: Number(configMap["min_trips_per_day"] || configMap["MIN_TRIPS_PER_DAY"] || 1)
      }
    });
  } catch (err) {
    console.error("[MasterData] Query error:", err);
    return buildError("SERVER_ERROR", "ไม่สามารถดึงข้อมูล Master ได้ กรุณาลองใหม่อีกครั้ง", 500);
  }
}
