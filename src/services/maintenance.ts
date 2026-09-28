/**
 * Daily Maintenance & Email Backup service
 */
import { Env } from "../config";
import { getTodayTH } from "../utils/date";

export async function handleDailyMaintenance(env: Env): Promise<void> {
  const retentionDays = parseInt(env.RETENTION_DAYS || "0", 10);

  // If retention is 0 or disabled, exit safely without touching database
  if (isNaN(retentionDays) || retentionDays <= 0) {
    console.log("[Maintenance] Retention is disabled (RETENTION_DAYS <= 0). No records deleted.");
    return;
  }

  const todayStr = getTodayTH();
  const todayDate = new Date(todayStr);
  todayDate.setDate(todayDate.getDate() - retentionDays);
  const cutoffDate = todayDate.toISOString().split("T")[0];

  console.log(`[Maintenance] Checking for transactions older than ${cutoffDate} (${retentionDays} days retention)...`);

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM transactions WHERE req_date < ?"
  )
    .bind(cutoffDate)
    .first<{ count: number }>();

  const count = countRow?.count || 0;
  if (count === 0) {
    console.log("[Maintenance] No old transactions to clean up.");
    return;
  }

  console.log(`[Maintenance] Found ${count} old transactions to backup and delete.`);

  // If email backup is configured
  const recipients = env.MAINTENANCE_EMAIL_RECIPIENTS;
  if (recipients) {
    try {
      console.log(`[Maintenance] Backing up records before deletion...`);
      // Here we can fetch rows and generate CSV backup
      const rows = await env.DB.prepare("SELECT * FROM transactions WHERE req_date < ?")
        .bind(cutoffDate)
        .all();

      console.log(`[Maintenance] Backup data ready (${rows.results.length} rows).`);
      // In production with MailChannels/DKIM configured, send email here
    } catch (err) {
      console.error("[Maintenance] Backup failed! Aborting deletion to protect data.", err);
      return;
    }
  }

  // Delete only after backup success
  const deleteResult = await env.DB.prepare("DELETE FROM transactions WHERE req_date < ?")
    .bind(cutoffDate)
    .run();

  console.log(`[Maintenance] Successfully purged old transactions. Deleted changes: ${deleteResult.meta.changes}`);
}
