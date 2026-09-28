/**
 * Trip1Day Worker Entrypoint (ver.3.0)
 * Handles API endpoints, Static Asset serving, and Cron Trigger
 */
import { Env, ERROR_CODES } from "./config";
import { handleCorsPreflight, buildError } from "./utils/response";
import { verifyLineToken } from "./middleware/auth";
import { handleGetConfig } from "./routes/config";
import { handleGetMasterData } from "./routes/master";
import { handleGetProfile } from "./routes/profile";
import {
  handleGetTransactions,
  handleSubmitTransaction,
  handleDeleteTransaction
} from "./routes/transactions";
import { handleDailyMaintenance } from "./services/maintenance";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Ensure DB binding (supports both IMG_DB and DB)
    const db = env.IMG_DB || env.DB;
    if (db) {
      env.DB = db;
      env.IMG_DB = db;
    }

    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return handleCorsPreflight();
    }

    // 2. Public API: Runtime Configuration
    if (request.method === "GET" && url.pathname === "/api/config") {
      return handleGetConfig(env);
    }

    // 3. API Routes handling (/api/*)
    if (url.pathname.startsWith("/api/")) {
      // Authenticate user for protected routes
      const userId = await verifyLineToken(request, env);
      if (!userId) {
        return buildError(
          ERROR_CODES.UNAUTHORIZED,
          "การยืนยันตัวตน LINE ไม่ถูกต้อง หรือ Session หมดอายุ กรุณาเปิดแอพใหม่อีกครั้ง",
          401
        );
      }

      // GET /api/master (Master Lookup Data)
      if (request.method === "GET" && url.pathname === "/api/master") {
        return handleGetMasterData(env);
      }

      // GET /api/profile (User Profile + Today TH)
      if (request.method === "GET" && url.pathname === "/api/profile") {
        return handleGetProfile(env, userId);
      }

      // Transactions Endpoints
      if (url.pathname === "/api/transactions") {
        if (request.method === "GET") {
          const dateParam = url.searchParams.get("date");
          return handleGetTransactions(env, userId, dateParam);
        }

        if (request.method === "POST") {
          return handleSubmitTransaction(env, userId, request);
        }
      }

      // DELETE /api/transactions/:id
      if (request.method === "DELETE" && url.pathname.startsWith("/api/transactions/")) {
        const parts = url.pathname.split("/");
        const txId = parts[3];
        return handleDeleteTransaction(env, userId, txId);
      }

      return buildError(ERROR_CODES.NOT_FOUND, "ไม่พบ API Endpoint ที่เรียก", 404);
    }

    // 4. Static Assets fallback (Cloudflare Workers Static Assets)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },

  /**
   * Cloudflare Cron Trigger (Daily Maintenance)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const db = env.IMG_DB || env.DB;
    if (db) {
      env.DB = db;
      env.IMG_DB = db;
    }
    ctx.waitUntil(handleDailyMaintenance(env));
  }
};
