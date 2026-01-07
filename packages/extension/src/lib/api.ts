import { DEFAULT_SERVER_URL } from "./constants";
import type {
  CreateWorktreeRequest,
  CreateWorktreeResponse,
  HealthResponse,
  OpenWorktreeRequest,
  OpenWorktreeResponse,
  WorktreeExistsResponse,
  WorktreeErrorResponse,
  TestTerminalRequest,
  TestTerminalResponse,
} from "./types";

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 10000;

/**
 * API error class for handling server errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Network error class for handling connection failures
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

/**
 * Worktree exists error - specific error type for 409 conflicts
 */
export class WorktreeExistsError extends Error {
  constructor(
    message: string,
    public readonly directory: string
  ) {
    super(message);
    this.name = "WorktreeExistsError";
  }
}

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

/**
 * Make a fetch request with timeout handling
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = createTimeoutController(timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new NetworkError(`Request timed out after ${timeoutMs}ms`);
      }
      // Handle network errors (server not running, etc.)
      if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError") ||
        error.message.includes("ERR_CONNECTION_REFUSED")
      ) {
        throw new NetworkError(
          "Unable to connect to server. Is the worktree server running?"
        );
      }
    }
    throw error;
  }
}

/**
 * Parse response and validate type
 */
async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new ApiError(
      "Server returned non-JSON response",
      response.status,
      "invalid_response"
    );
  }

  const data = await response.json();
  return data as T;
}

/**
 * Check if the server is healthy
 */
export async function healthCheck(
  serverUrl: string = DEFAULT_SERVER_URL
): Promise<HealthResponse> {
  const response = await fetchWithTimeout(`${serverUrl}/health`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new ApiError(
      "Health check failed",
      response.status,
      "health_check_failed"
    );
  }

  return parseResponse<HealthResponse>(response);
}

/**
 * Create a new worktree
 *
 * @returns CreateWorktreeResponse on success
 * @throws WorktreeExistsError if worktree already exists (409)
 * @throws ApiError for other API errors
 * @throws NetworkError for connection failures
 */
export async function createWorktree(
  request: CreateWorktreeRequest,
  serverUrl: string = DEFAULT_SERVER_URL
): Promise<CreateWorktreeResponse> {
  const response = await fetchWithTimeout(`${serverUrl}/worktree/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request),
  });

  // Handle conflict (worktree already exists)
  if (response.status === 409) {
    const errorData = await parseResponse<WorktreeExistsResponse>(response);
    throw new WorktreeExistsError(errorData.message, errorData.directory);
  }

  // Handle other errors
  if (!response.ok) {
    const errorData = await parseResponse<WorktreeErrorResponse>(response);
    throw new ApiError(errorData.message, response.status, errorData.error);
  }

  return parseResponse<CreateWorktreeResponse>(response);
}

/**
 * Open an existing worktree in terminal
 *
 * @returns OpenWorktreeResponse on success
 * @throws ApiError for API errors
 * @throws NetworkError for connection failures
 */
export async function openWorktree(
  request: OpenWorktreeRequest,
  serverUrl: string = DEFAULT_SERVER_URL
): Promise<OpenWorktreeResponse> {
  const response = await fetchWithTimeout(`${serverUrl}/worktree/open`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request),
  });

  // Handle errors
  if (!response.ok) {
    const errorData = await parseResponse<WorktreeErrorResponse>(response);
    throw new ApiError(errorData.message, response.status, errorData.error);
  }

  return parseResponse<OpenWorktreeResponse>(response);
}

/**
 * Check if the server is reachable (simple connectivity check)
 *
 * @returns true if server is reachable, false otherwise
 */
export async function isServerReachable(
  serverUrl: string = DEFAULT_SERVER_URL
): Promise<boolean> {
  try {
    await healthCheck(serverUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Test a terminal command with sample values
 *
 * @returns TestTerminalResponse with the expanded command and output
 * @throws ApiError for API errors
 * @throws NetworkError for connection failures
 */
export async function testTerminalCommand(
  request: TestTerminalRequest,
  serverUrl: string = DEFAULT_SERVER_URL
): Promise<TestTerminalResponse> {
  const response = await fetchWithTimeout(`${serverUrl}/terminal/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request),
  });

  // Parse the response (we always expect JSON from this endpoint)
  const data = await parseResponse<TestTerminalResponse>(response);

  // Handle errors (the response includes success: false for errors)
  if (!response.ok && !data.success) {
    throw new ApiError(
      data.message || "Failed to test terminal command",
      response.status,
      data.error
    );
  }

  return data;
}
