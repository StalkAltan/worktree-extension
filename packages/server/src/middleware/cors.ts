/**
 * CORS Middleware
 *
 * Handles Cross-Origin Resource Sharing for the worktree server.
 * Allows requests from:
 * - chrome-extension:// origins (the Chrome extension)
 * - https://linear.app (Linear website for content scripts)
 */

import type { Middleware } from "../router";

/**
 * Allowed origin patterns for CORS
 */
const ALLOWED_ORIGIN_PATTERNS = [
  /^chrome-extension:\/\/.+$/, // Chrome extension origins
  /^https:\/\/linear\.app$/, // Linear website
];

/**
 * Check if an origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

/**
 * Get CORS headers for a response
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {};

  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400"; // 24 hours
  }

  return headers;
}

/**
 * Create CORS headers object from a record
 */
function toHeaders(record: Record<string, string>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(record)) {
    headers.set(key, value);
  }
  return headers;
}

/**
 * CORS middleware for the router
 *
 * - Handles preflight OPTIONS requests
 * - Adds CORS headers to all responses
 */
export function corsMiddleware(): Middleware {
  return async (request, next) => {
    const origin = request.headers.get("Origin");
    const corsHeaders = getCorsHeaders(origin);

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: toHeaders(corsHeaders),
      });
    }

    // Process the request
    const response = await next();

    // Add CORS headers to the response
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}
