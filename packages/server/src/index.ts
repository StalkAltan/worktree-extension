/**
 * Worktree Server Entry Point
 *
 * A local HTTP server that handles git worktree operations and terminal spawning.
 * Communicates with the Chrome extension to create/open worktrees from Linear issues.
 */

import { createRouter } from "./router";
import { corsMiddleware } from "./middleware/cors";
import { createHealthHandler } from "./routes/health";

const PORT = 21547;
const VERSION = "1.0.0";

// Create router and register routes
const router = createRouter();

// Apply CORS middleware
router.use(corsMiddleware());

// Register routes
router.get("/health", createHealthHandler(VERSION));

// Start the server
const server = Bun.serve({
  port: PORT,
  fetch(request: Request): Promise<Response> {
    return router.handle(request);
  },
});

console.log(`Worktree server v${VERSION} listening on http://localhost:${server.port}`);
