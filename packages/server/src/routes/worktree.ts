/**
 * Worktree Routes
 *
 * Handles worktree creation and opening endpoints.
 * POST /worktree/create - Creates a new worktree with a new branch
 * POST /worktree/open - Opens an existing worktree in terminal
 */

import { exists } from "fs/promises";
import type { RouteHandler } from "../router";
import {
  validateRepoPath,
  buildWorktreePath,
  createWorktree,
  checkWorktreeExists,
} from "../services/git";
import { executeTerminalCommand } from "../services/terminal";
import { ValidationError, errorToResponse } from "../lib/errors";

/**
 * Request body for POST /worktree/create
 */
interface CreateWorktreeRequest {
  issueId: string;
  repoPath: string;
  branchName: string;
  baseBranch: string;
  worktreeRoot: string;
  terminalCommand: string;
}

/**
 * Request body for POST /worktree/open
 */
interface OpenWorktreeRequest {
  directory: string;
  terminalCommand: string;
  issueId: string;
  branchName: string;
}

/**
 * Validates that all required fields are present in the request body.
 */
function validateCreateRequest(body: unknown): CreateWorktreeRequest {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be a JSON object");
  }

  const obj = body as Record<string, unknown>;
  const requiredFields = [
    "issueId",
    "repoPath",
    "branchName",
    "baseBranch",
    "worktreeRoot",
    "terminalCommand",
  ];

  for (const field of requiredFields) {
    if (typeof obj[field] !== "string" || obj[field] === "") {
      throw new ValidationError(`Missing required field: ${field}`);
    }
  }

  return obj as unknown as CreateWorktreeRequest;
}

/**
 * Validates that all required fields are present in the open request body.
 */
function validateOpenRequest(body: unknown): OpenWorktreeRequest {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be a JSON object");
  }

  const obj = body as Record<string, unknown>;
  const requiredFields = ["directory", "terminalCommand", "issueId", "branchName"];

  for (const field of requiredFields) {
    if (typeof obj[field] !== "string" || obj[field] === "") {
      throw new ValidationError(`Missing required field: ${field}`);
    }
  }

  return obj as unknown as OpenWorktreeRequest;
}

/**
 * Create the POST /worktree/create route handler.
 * Creates a new git worktree with a new branch and opens it in a terminal.
 */
export function createWorktreeCreateHandler(): RouteHandler {
  return async (request: Request) => {
    try {
      // Parse and validate request body
      const body = await request.json();
      const data = validateCreateRequest(body);

      // Validate repository path exists and is a git repo
      await validateRepoPath(data.repoPath);

      // Build the worktree directory path
      const worktreeDirectory = buildWorktreePath(
        data.worktreeRoot,
        data.repoPath,
        data.branchName
      );

      // Create the worktree (this validates base branch and checks for conflicts)
      const result = await createWorktree(
        data.repoPath,
        data.branchName,
        data.baseBranch,
        worktreeDirectory
      );

      // Open terminal at the new worktree
      executeTerminalCommand(data.terminalCommand, {
        directory: result.directory,
        issueId: data.issueId,
        branchName: data.branchName,
      });

      return Response.json({
        success: true,
        directory: result.directory,
      });
    } catch (error) {
      if (error instanceof Error) {
        const { status, body } = errorToResponse(error);
        return Response.json(body, { status });
      }
      return Response.json(
        { error: "internal", message: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  };
}

/**
 * Create the POST /worktree/open route handler.
 * Opens an existing worktree directory in a terminal.
 */
export function createWorktreeOpenHandler(): RouteHandler {
  return async (request: Request) => {
    try {
      // Parse and validate request body
      const body = await request.json();
      const data = validateOpenRequest(body);

      // Validate directory exists
      const dirExists = await exists(data.directory);
      if (!dirExists) {
        throw new ValidationError("Directory does not exist");
      }

      // Validate it's actually a worktree (has .git file)
      const worktreeCheck = await checkWorktreeExists(data.directory);
      if (!worktreeCheck.exists) {
        throw new ValidationError("Directory is not a valid git worktree");
      }

      // Open terminal at the worktree
      executeTerminalCommand(data.terminalCommand, {
        directory: data.directory,
        issueId: data.issueId,
        branchName: data.branchName,
      });

      return Response.json({
        success: true,
      });
    } catch (error) {
      if (error instanceof Error) {
        const { status, body } = errorToResponse(error);
        return Response.json(body, { status });
      }
      return Response.json(
        { error: "internal", message: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  };
}
