/**
 * Request Router
 *
 * Handles routing of HTTP requests to appropriate handlers.
 * Supports middleware chains and typed route handlers.
 */

export type RouteHandler = (request: Request, params: RouteParams) => Response | Promise<Response>;

export type Middleware = (
  request: Request,
  next: () => Response | Promise<Response>
) => Response | Promise<Response>;

export interface RouteParams {
  pathname: string;
  searchParams: URLSearchParams;
}

interface Route {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
}

/**
 * Simple HTTP router for Bun.serve
 */
export class Router {
  private routes: Route[] = [];
  private middlewares: Middleware[] = [];

  /**
   * Register a middleware function
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Register a GET route handler
   */
  get(path: string, handler: RouteHandler): this {
    return this.addRoute("GET", path, handler);
  }

  /**
   * Register a POST route handler
   */
  post(path: string, handler: RouteHandler): this {
    return this.addRoute("POST", path, handler);
  }

  /**
   * Register a route with any HTTP method
   */
  addRoute(method: string, path: string, handler: RouteHandler): this {
    // Convert path to regex pattern
    // Supports simple paths like "/health" and "/worktree/create"
    const pattern = new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
    this.routes.push({ method, pattern, handler });
    return this;
  }

  /**
   * Handle an incoming request
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const params: RouteParams = {
      pathname: url.pathname,
      searchParams: url.searchParams,
    };

    // Find matching route
    const route = this.routes.find(
      (r) => r.method === request.method && r.pattern.test(url.pathname)
    );

    // Create the handler chain with middlewares
    const finalHandler = async (): Promise<Response> => {
      if (!route) {
        return Response.json(
          { error: "not_found", message: "Endpoint not found" },
          { status: 404 }
        );
      }
      return route.handler(request, params);
    };

    // Apply middlewares in reverse order to create the chain
    let handler = finalHandler;
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const middleware = this.middlewares[i];
      const nextHandler = handler;
      handler = () => middleware(request, nextHandler);
    }

    return handler();
  }
}

/**
 * Create a new router instance
 */
export function createRouter(): Router {
  return new Router();
}
