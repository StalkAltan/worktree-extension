/**
 * Health Check Route
 *
 * Provides a simple health check endpoint for the extension to verify
 * that the server is running and responsive.
 */

import type { RouteHandler } from "../router";

export interface HealthResponse {
  status: "ok";
  version: string;
}

/**
 * Create the health check route handler
 */
export function createHealthHandler(version: string): RouteHandler {
  return () => {
    const response: HealthResponse = {
      status: "ok",
      version,
    };
    return Response.json(response);
  };
}
