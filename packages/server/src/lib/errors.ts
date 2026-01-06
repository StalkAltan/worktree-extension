/**
 * Custom error classes for the worktree server.
 * These errors are caught by route handlers and mapped to appropriate HTTP responses.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class GitError extends Error {
  constructor(message: string, public stderr?: string) {
    super(message);
    this.name = "GitError";
  }
}

export class WorktreeExistsError extends Error {
  constructor(public directory: string) {
    super(`Worktree already exists at ${directory}`);
    this.name = "WorktreeExistsError";
  }
}

export class BranchExistsError extends Error {
  constructor(public branchName: string) {
    super(`Branch ${branchName} already exists`);
    this.name = "BranchExistsError";
  }
}

/**
 * Maps an error to an HTTP response object with appropriate status code and body.
 */
export function errorToResponse(error: Error): { status: number; body: object } {
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: { error: "validation", message: error.message }
    };
  }

  if (error instanceof WorktreeExistsError) {
    return {
      status: 409,
      body: { error: "exists", directory: error.directory, message: error.message }
    };
  }

  if (error instanceof BranchExistsError) {
    return {
      status: 409,
      body: { error: "branch_exists", message: error.message }
    };
  }

  if (error instanceof GitError) {
    return {
      status: 500,
      body: { error: "git_error", message: error.message }
    };
  }

  return {
    status: 500,
    body: { error: "internal", message: "An unexpected error occurred" }
  };
}
