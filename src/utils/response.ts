/**
 * Standard API Response helpers
 */

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Mock-Line-Uid",
  "Access-Control-Max-Age": "86400"
};

export function handleCorsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export function buildSuccess<T>(data: T, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...CORS_HEADERS,
        ...extraHeaders
      }
    }
  );
}

export function buildError(
  errorCode: string,
  message: string,
  status = 400,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error_code: errorCode,
      message
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...CORS_HEADERS,
        ...extraHeaders
      }
    }
  );
}
