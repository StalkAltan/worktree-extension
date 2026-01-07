/**
 * Terminal service for spawning terminal commands.
 * Handles command parsing, token replacement, and process spawning.
 */

import { log } from "../lib/logger";

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
 * Result from executing a terminal command with output capture.
 */
export interface TerminalTestResult {
  expandedCommand: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Executes a terminal command with token replacement and captures output.
 * Waits for the process to complete (with timeout) and returns the results.
 * Used for testing terminal commands.
 * 
 * @param command - The command template (e.g., "echo {directory}")
 * @param tokens - Token values to replace in the command
 * @param timeoutMs - Maximum time to wait for command completion (default: 10000ms)
 * @returns Promise with the expanded command, stdout, stderr, and exit code
 */
export async function executeTerminalCommandWithCapture(
  command: string,
  tokens: TerminalTokens,
  timeoutMs: number = 10000
): Promise<TerminalTestResult> {
  // Replace tokens in the command template
  const finalCommand = replaceTokens(command, tokens);

  // Parse command into parts respecting quotes
  const parts = parseCommand(finalCommand);

  log.info("Testing terminal command", {
    originalCommand: command,
    finalCommand,
    parsedParts: parts,
    tokens,
  });

  if (parts.length === 0) {
    log.error("Empty command after parsing", { command, finalCommand });
    throw new Error("Empty command after parsing");
  }

  const [executable, ...args] = parts;

  log.info("Spawning test process", { executable, args });

  try {
    const proc = Bun.spawn({
      cmd: [executable, ...args],
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Capture stdout
    const stdoutPromise = (async () => {
      if (!proc.stdout) return "";
      const chunks: Uint8Array[] = [];
      const reader = proc.stdout.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      return new TextDecoder().decode(
        Buffer.concat(chunks.map(chunk => Buffer.from(chunk)))
      );
    })();

    // Capture stderr
    const stderrPromise = (async () => {
      if (!proc.stderr) return "";
      const chunks: Uint8Array[] = [];
      const reader = proc.stderr.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      return new TextDecoder().decode(
        Buffer.concat(chunks.map(chunk => Buffer.from(chunk)))
      );
    })();

    // Wait for all to complete or timeout
    const [stdout, stderr, exitCode] = await Promise.race([
      Promise.all([stdoutPromise, stderrPromise, proc.exited]),
      timeoutPromise,
    ]);

    log.info("Test command completed", {
      executable,
      exitCode,
      stdoutLength: stdout.length,
      stderrLength: stderr.length,
    });

    return {
      expandedCommand: finalCommand,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
    };
  } catch (error) {
    log.error("Failed to execute test command", {
      executable,
      args,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Executes a terminal command with token replacement.
 * Spawns the process in detached mode so it continues after the server responds.
 * 
 * @param command - The command template (e.g., "ghostty -e bash -c 'cd {directory} && opencode'")
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

  log.info("Executing terminal command", {
    originalCommand: command,
    finalCommand,
    parsedParts: parts,
    tokens,
  });

  if (parts.length === 0) {
    log.error("Empty command after parsing", { command, finalCommand });
    throw new Error("Empty command after parsing");
  }

  const [executable, ...args] = parts;

  log.info("Spawning process", { executable, args });

  try {
    // Spawn the process and capture output for debugging
    const proc = Bun.spawn({
      cmd: [executable, ...args],
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    // Capture and log stdout/stderr asynchronously for debugging
    // This helps diagnose issues like PATH errors
    captureProcessOutput(proc, executable);
  } catch (error) {
    log.error("Failed to spawn process", {
      executable,
      args,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Captures and logs process output for debugging purposes.
 * Runs asynchronously so it doesn't block the main execution.
 */
async function captureProcessOutput(
  proc: ReturnType<typeof Bun.spawn>,
  executable: string
): Promise<void> {
  try {
    // Read stdout
    if (proc.stdout) {
      const stdoutReader = proc.stdout.getReader();
      const stdoutChunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await stdoutReader.read();
        if (done) break;
        if (value) stdoutChunks.push(value);
      }
      
      if (stdoutChunks.length > 0) {
        const stdout = new TextDecoder().decode(
          Buffer.concat(stdoutChunks.map(chunk => Buffer.from(chunk)))
        );
        if (stdout.trim()) {
          log.info("Process stdout", { executable, stdout: stdout.trim() });
        }
      }
    }

    // Read stderr
    if (proc.stderr) {
      const stderrReader = proc.stderr.getReader();
      const stderrChunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        if (value) stderrChunks.push(value);
      }
      
      if (stderrChunks.length > 0) {
        const stderr = new TextDecoder().decode(
          Buffer.concat(stderrChunks.map(chunk => Buffer.from(chunk)))
        );
        if (stderr.trim()) {
          log.warn("Process stderr", { executable, stderr: stderr.trim() });
        }
      }
    }

    // Wait for process to exit and log exit code
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      log.warn("Process exited with non-zero code", { executable, exitCode });
    } else {
      log.debug("Process exited successfully", { executable, exitCode });
    }
  } catch (error) {
    log.error("Error capturing process output", {
      executable,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
