// @bun
// src/router.ts
class Router {
  routes = [];
  middlewares = [];
  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }
  get(path, handler) {
    return this.addRoute("GET", path, handler);
  }
  post(path, handler) {
    return this.addRoute("POST", path, handler);
  }
  addRoute(method, path, handler) {
    const pattern = new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
    this.routes.push({ method, pattern, handler });
    return this;
  }
  async handle(request) {
    const url = new URL(request.url);
    const params = {
      pathname: url.pathname,
      searchParams: url.searchParams
    };
    const route = this.routes.find((r) => r.method === request.method && r.pattern.test(url.pathname));
    const finalHandler = async () => {
      if (!route) {
        return Response.json({ error: "not_found", message: "Endpoint not found" }, { status: 404 });
      }
      return route.handler(request, params);
    };
    let handler = finalHandler;
    for (let i = this.middlewares.length - 1;i >= 0; i--) {
      const middleware = this.middlewares[i];
      const nextHandler = handler;
      handler = () => middleware(request, nextHandler);
    }
    return Promise.resolve(handler());
  }
}
function createRouter() {
  return new Router;
}

// src/middleware/cors.ts
var ALLOWED_ORIGIN_PATTERNS = [
  /^chrome-extension:\/\/.+$/,
  /^https:\/\/linear\.app$/
];
function isOriginAllowed(origin) {
  if (!origin)
    return false;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}
function getCorsHeaders(origin) {
  const headers = {};
  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}
function toHeaders(record) {
  const headers = new Headers;
  for (const [key, value] of Object.entries(record)) {
    headers.set(key, value);
  }
  return headers;
}
function corsMiddleware() {
  return async (request, next) => {
    const origin = request.headers.get("Origin");
    const corsHeaders = getCorsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: toHeaders(corsHeaders)
      });
    }
    const response = await next();
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  };
}

// src/routes/health.ts
function createHealthHandler(version) {
  return () => {
    const response = {
      status: "ok",
      version
    };
    return Response.json(response);
  };
}

// src/routes/worktree.ts
import { exists as exists2 } from "fs/promises";

// src/services/git.ts
import { exists } from "fs/promises";
import { basename } from "path";

// src/lib/errors.ts
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

class GitError extends Error {
  stderr;
  constructor(message, stderr) {
    super(message);
    this.stderr = stderr;
    this.name = "GitError";
  }
}

class WorktreeExistsError extends Error {
  directory;
  constructor(directory) {
    super(`Worktree already exists at ${directory}`);
    this.directory = directory;
    this.name = "WorktreeExistsError";
  }
}

class BranchExistsError extends Error {
  branchName;
  constructor(branchName) {
    super(`Branch ${branchName} already exists`);
    this.branchName = branchName;
    this.name = "BranchExistsError";
  }
}
function errorToResponse(error) {
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

// src/services/git.ts
async function execGit(repoPath, args) {
  const proc = Bun.spawn(["git", "-C", repoPath, ...args], {
    stdout: "pipe",
    stderr: "pipe"
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new GitError(`Git command failed: git ${args.join(" ")}`, stderr.trim());
  }
  return stdout.trim();
}
async function execGitQuiet(repoPath, args) {
  const proc = Bun.spawn(["git", "-C", repoPath, ...args], {
    stdout: "ignore",
    stderr: "ignore"
  });
  const exitCode = await proc.exited;
  return exitCode === 0;
}
async function validateRepoPath(repoPath) {
  if (!await exists(repoPath)) {
    throw new ValidationError(`Repository path does not exist: ${repoPath}`);
  }
  const isGitRepo = await execGitQuiet(repoPath, ["rev-parse", "--git-dir"]);
  if (!isGitRepo) {
    throw new ValidationError(`Not a git repository: ${repoPath}`);
  }
}
async function validateBaseBranch(repoPath, baseBranch) {
  const branchExists = await checkBranchExists(repoPath, baseBranch);
  if (!branchExists.exists) {
    throw new ValidationError(`Base branch does not exist: ${baseBranch}`);
  }
}
async function checkBranchExists(repoPath, branchName) {
  const exists2 = await execGitQuiet(repoPath, ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`]);
  return { exists: exists2 };
}
async function checkWorktreeExists(directory) {
  const dirExists = await exists(directory);
  if (!dirExists) {
    return { exists: false };
  }
  const gitPath = `${directory}/.git`;
  const gitExists = await exists(gitPath);
  return {
    exists: gitExists,
    directory: gitExists ? directory : undefined
  };
}
function getRepoName(repoPath) {
  return basename(repoPath);
}
function buildWorktreePath(worktreeRoot, repoPath, branchName) {
  const repoName = getRepoName(repoPath);
  return `${worktreeRoot}/${repoName}/${branchName}`;
}
async function createWorktree(repoPath, branchName, baseBranch, worktreeDirectory) {
  const worktreeCheck = await checkWorktreeExists(worktreeDirectory);
  if (worktreeCheck.exists) {
    throw new WorktreeExistsError(worktreeDirectory);
  }
  const branchCheck = await checkBranchExists(repoPath, branchName);
  if (branchCheck.exists) {
    throw new BranchExistsError(branchName);
  }
  await validateBaseBranch(repoPath, baseBranch);
  await execGit(repoPath, ["worktree", "add", "-b", branchName, worktreeDirectory, baseBranch]);
  return {
    directory: worktreeDirectory,
    branchCreated: true
  };
}

// src/lib/logger.ts
function formatTimestamp() {
  return new Date().toISOString();
}
function formatMessage(level, message, context) {
  const timestamp = formatTimestamp();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}
var log = {
  debug(message, context) {
    console.debug(formatMessage("debug", message, context));
  },
  info(message, context) {
    console.info(formatMessage("info", message, context));
  },
  warn(message, context) {
    console.warn(formatMessage("warn", message, context));
  },
  error(message, context) {
    console.error(formatMessage("error", message, context));
  }
};

// src/services/terminal.ts
function replaceTokens(command, tokens) {
  let result = command;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}
function parseCommand(command) {
  const parts = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let i = 0;
  while (i < command.length) {
    const char = command[i];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === " " && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        parts.push(current);
        current = "";
      }
    } else {
      current += char;
    }
    i++;
  }
  if (current.length > 0) {
    parts.push(current);
  }
  return parts;
}
function executeTerminalCommand(command, tokens) {
  const finalCommand = replaceTokens(command, tokens);
  const parts = parseCommand(finalCommand);
  log.info("Executing terminal command", {
    originalCommand: command,
    finalCommand,
    parsedParts: parts,
    tokens
  });
  if (parts.length === 0) {
    log.error("Empty command after parsing", { command, finalCommand });
    throw new Error("Empty command after parsing");
  }
  const [executable, ...args] = parts;
  log.info("Spawning process", { executable, args });
  try {
    const proc = Bun.spawn({
      cmd: [executable, ...args],
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore"
    });
    captureProcessOutput(proc, executable);
  } catch (error) {
    log.error("Failed to spawn process", {
      executable,
      args,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
async function captureProcessOutput(proc, executable) {
  try {
    if (proc.stdout) {
      const stdoutReader = proc.stdout.getReader();
      const stdoutChunks = [];
      while (true) {
        const { done, value } = await stdoutReader.read();
        if (done)
          break;
        if (value)
          stdoutChunks.push(value);
      }
      if (stdoutChunks.length > 0) {
        const stdout = new TextDecoder().decode(Buffer.concat(stdoutChunks.map((chunk) => Buffer.from(chunk))));
        if (stdout.trim()) {
          log.info("Process stdout", { executable, stdout: stdout.trim() });
        }
      }
    }
    if (proc.stderr) {
      const stderrReader = proc.stderr.getReader();
      const stderrChunks = [];
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done)
          break;
        if (value)
          stderrChunks.push(value);
      }
      if (stderrChunks.length > 0) {
        const stderr = new TextDecoder().decode(Buffer.concat(stderrChunks.map((chunk) => Buffer.from(chunk))));
        if (stderr.trim()) {
          log.warn("Process stderr", { executable, stderr: stderr.trim() });
        }
      }
    }
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      log.warn("Process exited with non-zero code", { executable, exitCode });
    } else {
      log.debug("Process exited successfully", { executable, exitCode });
    }
  } catch (error) {
    log.error("Error capturing process output", {
      executable,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// src/routes/worktree.ts
function validateCreateRequest(body) {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be a JSON object");
  }
  const obj = body;
  const requiredFields = [
    "issueId",
    "repoPath",
    "branchName",
    "baseBranch",
    "worktreeRoot",
    "terminalCommand"
  ];
  for (const field of requiredFields) {
    if (typeof obj[field] !== "string" || obj[field] === "") {
      throw new ValidationError(`Missing required field: ${field}`);
    }
  }
  return obj;
}
function validateOpenRequest(body) {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be a JSON object");
  }
  const obj = body;
  const requiredFields = ["directory", "terminalCommand", "issueId", "branchName"];
  for (const field of requiredFields) {
    if (typeof obj[field] !== "string" || obj[field] === "") {
      throw new ValidationError(`Missing required field: ${field}`);
    }
  }
  return obj;
}
function createWorktreeCreateHandler() {
  return async (request) => {
    try {
      const body = await request.json();
      const data = validateCreateRequest(body);
      await validateRepoPath(data.repoPath);
      const worktreeDirectory = buildWorktreePath(data.worktreeRoot, data.repoPath, data.branchName);
      const result = await createWorktree(data.repoPath, data.branchName, data.baseBranch, worktreeDirectory);
      executeTerminalCommand(data.terminalCommand, {
        directory: result.directory,
        issueId: data.issueId,
        branchName: data.branchName
      });
      return Response.json({
        success: true,
        directory: result.directory
      });
    } catch (error) {
      if (error instanceof Error) {
        const { status, body } = errorToResponse(error);
        return Response.json(body, { status });
      }
      return Response.json({ error: "internal", message: "An unexpected error occurred" }, { status: 500 });
    }
  };
}
function createWorktreeOpenHandler() {
  return async (request) => {
    try {
      const body = await request.json();
      const data = validateOpenRequest(body);
      const dirExists = await exists2(data.directory);
      if (!dirExists) {
        throw new ValidationError("Directory does not exist");
      }
      const worktreeCheck = await checkWorktreeExists(data.directory);
      if (!worktreeCheck.exists) {
        throw new ValidationError("Directory is not a valid git worktree");
      }
      executeTerminalCommand(data.terminalCommand, {
        directory: data.directory,
        issueId: data.issueId,
        branchName: data.branchName
      });
      return Response.json({
        success: true
      });
    } catch (error) {
      if (error instanceof Error) {
        const { status, body } = errorToResponse(error);
        return Response.json(body, { status });
      }
      return Response.json({ error: "internal", message: "An unexpected error occurred" }, { status: 500 });
    }
  };
}

// src/index.ts
var PORT = 21547;
var VERSION = "1.0.0";
var router = createRouter();
router.use(corsMiddleware());
router.get("/health", createHealthHandler(VERSION));
router.post("/worktree/create", createWorktreeCreateHandler());
router.post("/worktree/open", createWorktreeOpenHandler());
var server = Bun.serve({
  port: PORT,
  fetch(request) {
    return router.handle(request);
  }
});
console.log(`Worktree server v${VERSION} listening on http://localhost:${server.port}`);
