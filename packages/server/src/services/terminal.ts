/**
 * Terminal service for spawning terminal commands.
 * Handles command parsing, token replacement, and process spawning.
 */

/**
 * Token values that can be replaced in terminal command templates.
 */
export interface TerminalTokens {
  directory: string;
  issueId: string;
  branchName: string;
}

/**
 * Replaces tokens in a command template with actual values.
 * Tokens are in the format {tokenName}.
 * @param command - The command template with tokens
 * @param tokens - The token values to substitute
 * @returns The command with all tokens replaced
 */
export function replaceTokens(command: string, tokens: TerminalTokens): string {
  let result = command;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

/**
 * Parses a command string into an array of arguments, respecting quoted strings.
 * Handles both single and double quotes.
 * 
 * Examples:
 *   'ghostty -e "cd /path && run"' => ['ghostty', '-e', 'cd /path && run']
 *   "cmd 'arg with spaces'" => ['cmd', 'arg with spaces']
 * 
 * @param command - The full command string to parse
 * @returns Array of command parts (executable and arguments)
 */
export function parseCommand(command: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let i = 0;

  while (i < command.length) {
    const char = command[i];

    if (char === "'" && !inDoubleQuote) {
      // Toggle single quote mode
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      // Toggle double quote mode
      inDoubleQuote = !inDoubleQuote;
    } else if (char === " " && !inSingleQuote && !inDoubleQuote) {
      // Space outside quotes - end of argument
      if (current.length > 0) {
        parts.push(current);
        current = "";
      }
    } else {
      // Regular character - add to current argument
      current += char;
    }

    i++;
  }

  // Don't forget the last argument
  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
}

/**
 * Executes a terminal command with token replacement.
 * Spawns the process in detached mode so it continues after the server responds.
 * 
 * @param command - The command template (e.g., "ghostty -e 'cd {directory} && opencode'")
 * @param tokens - Token values to replace in the command
 */
export function executeTerminalCommand(
  command: string,
  tokens: TerminalTokens
): void {
  // Replace tokens in the command template
  const finalCommand = replaceTokens(command, tokens);

  // Parse command into parts respecting quotes
  const parts = parseCommand(finalCommand);

  if (parts.length === 0) {
    throw new Error("Empty command after parsing");
  }

  const [executable, ...args] = parts;

  // Spawn detached process
  // Using Bun.spawn with detached mode so the terminal process
  // continues to run independently of the server
  Bun.spawn({
    cmd: [executable, ...args],
    // Note: Bun doesn't have a 'detached' option like Node's child_process
    // Instead, we just don't wait for it and ignore all stdio
    stdout: "ignore",
    stderr: "ignore",
    stdin: "ignore",
  });
}
