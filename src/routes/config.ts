/**
 * Route: GET /api/config
 * Returns client configuration including LIFF ID
 */
import { Env, APP_VERSION } from "../config";
import { buildSuccess } from "../utils/response";

export async function handleGetConfig(env: Env): Promise<Response> {
  const liffId = env.LIFF_ID || "2009016720-k0zSXOrx";
  const allowDevMock = env.ALLOW_DEV_MOCK === "true" || env.ENVIRONMENT !== "production";

  return buildSuccess({
    liff_id: liffId,
    app_version: APP_VERSION,
    environment: env.ENVIRONMENT || "production",
    allow_dev_mock: allowDevMock
  });
}
