import type { ExtensionConfig } from "./types";

// Server configuration
export const DEFAULT_PORT = 21547;
export const DEFAULT_SERVER_URL = `http://localhost:${DEFAULT_PORT}`;

// Default terminal command with token placeholders
// Tokens: {directory}, {issueId}, {branchName}
// Note: We use explicit shell invocation (bash -c) because 'cd' is a shell builtin
// and '&&' is shell syntax that requires a shell to interpret properly.
export const DEFAULT_TERMINAL_COMMAND = "ghostty -e bash -c 'cd {directory} && opencode'";

// Chrome storage key
export const STORAGE_KEY = "config";

// Branch name constraints
export const MAX_BRANCH_NAME_LENGTH = 100;

// Default configuration
export const DEFAULT_CONFIG: ExtensionConfig = {
  serverUrl: DEFAULT_SERVER_URL,
  worktreeRoot: "", // Must be configured by user
  terminalCommand: DEFAULT_TERMINAL_COMMAND,
  projectMappings: {},
};
