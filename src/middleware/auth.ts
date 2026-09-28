/**
 * Authentication middleware: Validates LINE Access Token or Dev Mock
 */
import { Env } from "../config";

export async function verifyLineToken(request: Request, env: Env): Promise<string | null> {
  const url = new URL(request.url);

  // 1. Check Dev Mock Mode
  const isDevMockAllowed = env.ALLOW_DEV_MOCK === "true" || env.ENVIRONMENT !== "production";
  if (isDevMockAllowed) {
    const mockHeader = request.headers.get("X-Mock-Line-Uid");
    if (mockHeader && mockHeader.trim() !== "") {
      return mockHeader.trim();
    }

    const mockQuery = url.searchParams.get("mock_uid");
    if (mockQuery && mockQuery.trim() !== "") {
      return mockQuery.trim();
    }
  }

  // 2. Read Authorization Header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  // If mock token used in Dev Mock Mode
  if (isDevMockAllowed && (token.startsWith("MOCK_") || token === "USER-LOCAL-TEST")) {
    return token;
  }

  // 3. Verify with LINE Profile API
  try {
    const lineRes = await fetch("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!lineRes.ok) {
      console.warn(`[Auth] LINE Profile verification failed with HTTP ${lineRes.status}`);
      return null;
    }

    const profile = (await lineRes.json()) as { userId?: string };
    if (profile && profile.userId) {
      return profile.userId;
    }

    return null;
  } catch (err) {
    console.error("[Auth] Error contacting LINE API:", err);
    return null;
  }
}
