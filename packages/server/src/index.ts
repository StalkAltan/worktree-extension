/**
 * Worktree Server Entry Point
 *
 * A local HTTP server that handles git worktree operations and terminal spawning.
 * Communicates with the Chrome extension to create/open worktrees from Linear issues.
 */

import { createRouter } from "./router";

const PORT = 21547;
const VERSION = "1.0.0";

// Create router and register routes
const router = createRouter();

// Health check endpoint
router.get("/health", () => {
  return Response.json({
    status: "ok",
    version: VERSION,
  });
});

// Start the server
const server = Bun.serve({
  port: PORT,
  fetch(request: Request): Promise<Response> {
    return router.handle(request);
  },
});

console.log(`Worktree server v${VERSION} listening on http://localhost:${server.port}`);
