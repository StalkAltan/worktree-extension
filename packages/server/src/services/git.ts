/**
 * Git service for worktree operations.
 * Handles all git-related operations including branch checks, worktree management, and creation.
 */

import { exists } from "fs/promises";
import { basename } from "path";
import type { WorktreeInfo, WorktreeCheckResult, BranchCheckResult, WorktreeCreateResult } from "../lib/types";
import { GitError, ValidationError, WorktreeExistsError, BranchExistsError } from "../lib/errors";

/**
 * Executes a git command and returns the output.
 * @param repoPath - Path to the git repository
 * @param args - Git command arguments
 * @returns The stdout output from the command
 * @throws GitError if the command fails
 */
async function execGit(repoPath: string, args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", "-C", repoPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new GitError(`Git command failed: git ${args.join(" ")}`, stderr.trim());
  }

  return stdout.trim();
}

/**
 * Executes a git command and returns whether it succeeded (exit code 0).
 * @param repoPath - Path to the git repository
 * @param args - Git command arguments
 * @returns True if the command succeeded, false otherwise
 */
async function execGitQuiet(repoPath: string, args: string[]): Promise<boolean> {
  const proc = Bun.spawn(["git", "-C", repoPath, ...args], {
    stdout: "ignore",
    stderr: "ignore",
  });

  const exitCode = await proc.exited;
  return exitCode === 0;
}

/**
 * Validates that a repository path exists and is a git repository.
 * @param repoPath - Path to validate
 * @throws ValidationError if the path doesn't exist or isn't a git repo
 */
export async function validateRepoPath(repoPath: string): Promise<void> {
  if (!await exists(repoPath)) {
    throw new ValidationError(`Repository path does not exist: ${repoPath}`);
  }

  const isGitRepo = await execGitQuiet(repoPath, ["rev-parse", "--git-dir"]);
  if (!isGitRepo) {
    throw new ValidationError(`Not a git repository: ${repoPath}`);
  }
}

/**
 * Validates that a base branch exists in the repository.
 * @param repoPath - Path to the git repository
 * @param baseBranch - Name of the branch to validate
 * @throws ValidationError if the branch doesn't exist
 */
export async function validateBaseBranch(repoPath: string, baseBranch: string): Promise<void> {
  const branchExists = await checkBranchExists(repoPath, baseBranch);
  if (!branchExists.exists) {
    throw new ValidationError(`Base branch does not exist: ${baseBranch}`);
  }
}

/**
 * Checks if a branch exists in the repository.
 * @param repoPath - Path to the git repository
 * @param branchName - Name of the branch to check
 * @returns Result indicating if the branch exists
 */
export async function checkBranchExists(repoPath: string, branchName: string): Promise<BranchCheckResult> {
  const exists = await execGitQuiet(repoPath, ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`]);
  return { exists };
}

/**
 * Parses the output of `git worktree list --porcelain` into structured data.
 * @param output - Raw output from git worktree list --porcelain
 * @returns Array of WorktreeInfo objects
 */
function parseWorktreeListOutput(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const lines = output.split("\n");

  let current: Partial<WorktreeInfo> = {};

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      // Start of a new worktree entry
      if (current.path) {
        worktrees.push(current as WorktreeInfo);
      }
      current = { path: line.slice(9) };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice(5);
    } else if (line.startsWith("branch ")) {
      // Branch is refs/heads/branchname, extract just the branch name
      current.branch = line.slice(7).replace("refs/heads/", "");
    } else if (line === "") {
      // Empty line marks end of entry
      if (current.path) {
        worktrees.push(current as WorktreeInfo);
        current = {};
      }
    }
  }

  // Don't forget the last entry if there's no trailing newline
  if (current.path) {
    worktrees.push(current as WorktreeInfo);
  }

  return worktrees;
}

/**
 * Lists all worktrees for a repository.
 * @param repoPath - Path to the git repository
 * @returns Array of WorktreeInfo objects
 */
export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  const output = await execGit(repoPath, ["worktree", "list", "--porcelain"]);
  return parseWorktreeListOutput(output);
}

/**
 * Checks if a worktree exists at a specific directory.
 * @param directory - Path to check for worktree existence
 * @returns Result indicating if the worktree exists
 */
export async function checkWorktreeExists(directory: string): Promise<WorktreeCheckResult> {
  const dirExists = await exists(directory);
  if (!dirExists) {
    return { exists: false };
  }

  // Check if it's actually a git worktree by looking for .git file (worktrees have a .git file, not directory)
  const gitPath = `${directory}/.git`;
  const gitExists = await exists(gitPath);

  return {
    exists: gitExists,
    directory: gitExists ? directory : undefined,
  };
}

/**
 * Extracts the repository name from a repository path.
 * @param repoPath - Full path to the repository
 * @returns The repository name (last path segment)
 */
export function getRepoName(repoPath: string): string {
  return basename(repoPath);
}

/**
 * Builds the full path where a worktree will be created.
 * @param worktreeRoot - Root directory for all worktrees
 * @param repoPath - Path to the git repository
 * @param branchName - Name of the branch for the worktree
 * @returns Full path to the worktree directory
 */
export function buildWorktreePath(worktreeRoot: string, repoPath: string, branchName: string): string {
  const repoName = getRepoName(repoPath);
  return `${worktreeRoot}/${repoName}/${branchName}`;
}

/**
 * Creates a new worktree with a new branch.
 * @param repoPath - Path to the git repository
 * @param branchName - Name for the new branch
 * @param baseBranch - Base branch to create from
 * @param worktreeDirectory - Full path where the worktree should be created
 * @returns Result containing the worktree directory
 * @throws WorktreeExistsError if a worktree already exists at the target directory
 * @throws BranchExistsError if the branch already exists
 * @throws GitError if the git command fails
 */
export async function createWorktree(
  repoPath: string,
  branchName: string,
  baseBranch: string,
  worktreeDirectory: string
): Promise<WorktreeCreateResult> {
  // Check if worktree directory already exists
  const worktreeCheck = await checkWorktreeExists(worktreeDirectory);
  if (worktreeCheck.exists) {
    throw new WorktreeExistsError(worktreeDirectory);
  }

  // Check if branch already exists
  const branchCheck = await checkBranchExists(repoPath, branchName);
  if (branchCheck.exists) {
    throw new BranchExistsError(branchName);
  }

  // Validate base branch exists
  await validateBaseBranch(repoPath, baseBranch);

  // Create the worktree with a new branch
  // git worktree add -b <branch> <path> <base-branch>
  await execGit(repoPath, ["worktree", "add", "-b", branchName, worktreeDirectory, baseBranch]);

  return {
    directory: worktreeDirectory,
    branchCreated: true,
  };
}
