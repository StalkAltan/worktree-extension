/**
 * Terminal Routes
 *
 * Handles terminal-related endpoints for testing commands.
 * POST /terminal/test - Tests a terminal command with sample values
 */

import type { RouteHandler } from "../router";
import { executeTerminalCommandWithCapture } from "../services/terminal";
import { ValidationError, errorToResponse } from "../lib/errors";
import { log } from "../lib/logger";

/**
 * Request body for POST /terminal/test
 */
interface TestTerminalRequest {
  terminalCommand: string;
  directory?: string;
  issueId?: string;
  branchName?: string;
}

/**
 * Validates that the required fields are present in the request body.
 */
function validateTestRequest(body: unknown): TestTerminalRequest {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be a JSON object");
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.terminalCommand !== "string" || obj.terminalCommand === "") {
    throw new ValidationError("Missing required field: terminalCommand");
  }

  // Validate optional fields are strings if provided
  if (obj.directory !== undefined && typeof obj.directory !== "string") {
    throw new ValidationError("Field 'directory' must be a string");
  }
  if (obj.issueId !== undefined && typeof obj.issueId !== "string") {
    throw new ValidationError("Field 'issueId' must be a string");
  }
  if (obj.branchName !== undefined && typeof obj.branchName !== "string") {
    throw new ValidationError("Field 'branchName' must be a string");
  }

  return obj as unknown as TestTerminalRequest;
}

/**
 * Get the default directory for testing (user's home directory).
 */
function getDefaultDirectory(): string {
  return process.env.HOME || process.env.USERPROFILE || "/tmp";
}

/**
 * Create the POST /terminal/test route handler.
 * Tests a terminal command by executing it with provided or default token values.
 */
export function createTerminalTestHandler(): RouteHandler {
  return async (request: Request) => {
    try {
      // Parse and validate request body
      const body = await request.json();
      const data = validateTestRequest(body);

      // Use provided values or defaults
      const tokens = {
        directory: data.directory || getDefaultDirectory(),
        issueId: data.issueId || "TEST-1",
        branchName: data.branchName || "test-branch",
      };

      log.info("Testing terminal command", {
        command: data.terminalCommand,
        tokens,
      });

      // Execute the command with capture
      const result = await executeTerminalCommandWithCapture(
        data.terminalCommand,
        tokens
      );

      return Response.json({
        success: true,
        expandedCommand: result.expandedCommand,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
    } catch (error) {
      log.error("Terminal test failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof Error) {
        const { status, body } = errorToResponse(error);
        return Response.json(
          {
            success: false,
            ...body,
          },
          { status }
        );
      }
      return Response.json(
        {
          success: false,
          error: "internal",
          message: "An unexpected error occurred",
        },
        { status: 500 }
      );
    }
  };
}
