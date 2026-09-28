/**
 * Rate Calculation & Trip KM calculation service
 */

export interface TripDetail {
  trip_id: string;
  trip_no: number;
  type: "FIX" | "CUSTOM";
  trip_type: "SINGLE" | "ROUND_TRIP";
  route_id: string | null;
  route_name: string;
  origin: string;
  dest: string;
  km: number;
}

export function effectiveKm(trip: TripDetail): number {
  const km = Number(trip.km) || 0;
  // Rule: Only FIX + ROUND_TRIP is multiplied by 2
  if (trip.type === "FIX" && trip.trip_type === "ROUND_TRIP") {
    return Number((km * 2).toFixed(1));
  }
  return Number(km.toFixed(1));
}

export function calculateTotalKm(trips: TripDetail[]): number {
  const sum = trips.reduce((acc, t) => acc + effectiveKm(t), 0);
  return Number(sum.toFixed(1));
}

export async function getRateForDate(
  db: D1Database,
  reqDate: string,
  groupCar: number = 1
): Promise<number | null> {
  const row = await db
    .prepare(
      "SELECT group_car1, group_car2 FROM rate_car WHERE dt_date <= ? ORDER BY dt_date DESC LIMIT 1"
    )
    .bind(reqDate)
    .first<{ group_car1: number; group_car2: number }>();

  if (!row) {
    return null;
  }

  const rate = groupCar === 2 ? row.group_car2 : row.group_car1;
  return Number(rate);
}

export function calculateNetTotal(
  totalKm: number,
  rate: number,
  tollFee: number,
  parkFee: number,
  flatRateFee: number
): number {
  const mileageFee = totalKm * rate;
  const total = mileageFee + (Number(tollFee) || 0) + (Number(parkFee) || 0) + (Number(flatRateFee) || 0);
  return Number(total.toFixed(2));
}
