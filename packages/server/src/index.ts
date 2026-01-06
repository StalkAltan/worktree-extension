/**
 * Worktree Server Entry Point
 *
 * A local HTTP server that handles git worktree operations and terminal spawning.
 * Communicates with the Chrome extension to create/open worktrees from Linear issues.
 */

const PORT = 21547;
const VERSION = "1.0.0";

const server = Bun.serve({
  port: PORT,
  fetch(request: Request): Response {
    const url = new URL(request.url);

    // Health check endpoint
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        status: "ok",
        version: VERSION,
      });
    }

    // 404 for unmatched routes
    return Response.json(
      { error: "not_found", message: "Endpoint not found" },
      { status: 404 }
    );
  },
});

console.log(`Worktree server v${VERSION} listening on http://localhost:${server.port}`);
