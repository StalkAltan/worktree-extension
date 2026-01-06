/**
 * Server-specific type definitions for the worktree server
 */

/**
 * Information about a git worktree
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

/**
 * Generic result type for git service operations
 */
export interface GitServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Result of creating a new worktree
 */
export interface WorktreeCreateResult {
  directory: string;
  branchCreated: boolean;
}

/**
 * Result of checking if a worktree exists
 */
export interface WorktreeCheckResult {
  exists: boolean;
  directory?: string;
}

/**
 * Result of checking if a branch exists
 */
export interface BranchCheckResult {
  exists: boolean;
}
