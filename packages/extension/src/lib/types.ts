// Configuration stored in Chrome extension storage
export interface ExtensionConfig {
  serverUrl: string;
  worktreeRoot: string;
  terminalCommand: string;
  projectMappings: Record<string, ProjectMapping>;
}

export interface ProjectMapping {
  repoPath: string;
  baseBranch: string;
}

// Context extracted from Linear page
export interface LinearContext {
  issueId: string;        // e.g., "Q-3"
  teamCode: string;       // e.g., "Q"
  issueNumber: number;    // e.g., 3
  issueTitle: string;     // e.g., "Implement audit log endpoint spec"
  projectCode: string;    // e.g., "QUO" (from URL workspace or project)
}

// API request/response types
export interface CreateWorktreeRequest {
  issueId: string;
  repoPath: string;
  branchName: string;
  baseBranch: string;
  worktreeRoot: string;
  terminalCommand: string;
}

export interface CreateWorktreeResponse {
  success: true;
  directory: string;
}

export interface WorktreeExistsResponse {
  error: "exists";
  directory: string;
  message: string;
}

export interface WorktreeErrorResponse {
  error: string;
  message: string;
}

export interface OpenWorktreeRequest {
  directory: string;
  terminalCommand: string;
  issueId: string;
  branchName: string;
}

export interface OpenWorktreeResponse {
  success: true;
}

export interface HealthResponse {
  status: "ok";
  version: string;
}

// Dialog state
export type DialogState = 
  | { type: "closed" }
  | { type: "form" }
  | { type: "loading" }
  | { type: "conflict"; directory: string }
  | { type: "error"; message: string }
  | { type: "success"; directory: string };
