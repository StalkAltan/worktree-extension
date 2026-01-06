# Worktree Extension - Detailed Implementation Specification

## Overview

A Chrome extension that integrates with Linear to create git worktrees from issue pages, communicating with a local Bun server that handles git operations and terminal launching.

**Key Components:**
1. **Chrome Extension** - Injects UI into Linear, manages settings, communicates with server
2. **Local Bun Server** - Handles git worktree operations and terminal spawning

**Port:** `21547` (high port to avoid conflicts)

---

## Project Structure

```
worktree-extension/
├── package.json                    # Bun workspace root
├── bunfig.toml                     # Bun configuration
├── tsconfig.json                   # Base TypeScript config
├── DETAILED_SPEC.md                # This file
├── README.md                       # Project documentation
├── packages/
│   ├── extension/                  # Chrome Extension (Manifest V3)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── manifest.json           # Chrome extension manifest
│   │   ├── build.ts                # Bun build script
│   │   ├── src/
│   │   │   ├── content/            # Content script (injected into Linear)
│   │   │   │   ├── index.tsx       # Entry point, handles injection
│   │   │   │   ├── App.tsx         # Shadow DOM React app root
│   │   │   │   ├── components/
│   │   │   │   │   ├── WorktreeButton.tsx      # Button injected into Linear UI
│   │   │   │   │   ├── WorktreeDialog.tsx      # Modal dialog for creating worktree
│   │   │   │   │   ├── ConflictDialog.tsx      # Dialog for existing worktree conflict
│   │   │   │   │   └── LoadingSpinner.tsx      # Loading indicator
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useLinearContext.ts     # Parse Linear page context
│   │   │   │   │   └── usePageNavigation.ts    # Detect SPA navigation
│   │   │   │   └── styles/
│   │   │   │       └── content.css             # Scoped styles for Shadow DOM
│   │   │   ├── popup/              # Extension popup (toolbar icon click)
│   │   │   │   ├── index.html      # Popup HTML shell
│   │   │   │   ├── index.tsx       # Popup entry point
│   │   │   │   ├── App.tsx         # Popup React app root
│   │   │   │   ├── components/
│   │   │   │   │   ├── Navigation.tsx          # Tab navigation
│   │   │   │   │   ├── ServerStatus.tsx        # Health check indicator
│   │   │   │   │   ├── ProjectMappingRow.tsx   # Single mapping row in settings
│   │   │   │   │   └── Input.tsx               # Styled input components
│   │   │   │   ├── pages/
│   │   │   │   │   ├── Status.tsx              # Default status page
│   │   │   │   │   └── Settings.tsx            # Settings configuration page
│   │   │   │   └── styles/
│   │   │   │       └── popup.css               # Popup styles
│   │   │   ├── background/         # Service worker
│   │   │   │   └── index.ts        # Background script entry
│   │   │   └── lib/                # Shared utilities
│   │   │       ├── types.ts        # TypeScript type definitions
│   │   │       ├── storage.ts      # Chrome storage API wrapper
│   │   │       ├── api.ts          # Server API client
│   │   │       ├── branch-name.ts  # Branch name generation utilities
│   │   │       └── constants.ts    # Default values, constants
│   │   ├── public/                 # Static assets
│   │   │   └── icons/
│   │   │       ├── icon16.png
│   │   │       ├── icon32.png
│   │   │       ├── icon48.png
│   │   │       └── icon128.png
│   │   └── dist/                   # Built extension (gitignored)
│   │
│   └── server/                     # Local Bun HTTP server
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts            # Server entry point
│       │   ├── router.ts           # Request routing
│       │   ├── middleware/
│       │   │   └── cors.ts         # CORS handling
│       │   ├── routes/
│       │   │   ├── health.ts       # GET /health
│       │   │   └── worktree.ts     # POST /worktree/create, POST /worktree/open
│       │   ├── services/
│       │   │   ├── git.ts          # Git/worktree operations
│       │   │   └── terminal.ts     # Terminal spawning
│       │   └── lib/
│       │       ├── types.ts        # Server-specific types
│       │       └── errors.ts       # Custom error classes
│       └── scripts/
│           └── daemon.sh           # Script to run server as daemon
```

---

## Type Definitions

### Shared Types (`packages/extension/src/lib/types.ts`)

```typescript
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
```

### Server Types (`packages/server/src/lib/types.ts`)

```typescript
export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

export interface GitServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface WorktreeCreateResult {
  directory: string;
  branchCreated: boolean;
}

export interface WorktreeCheckResult {
  exists: boolean;
  directory?: string;
}

export interface BranchCheckResult {
  exists: boolean;
}
```

---

## API Specification

### Server Base URL
Default: `http://localhost:21547`

### Endpoints

#### GET `/health`

Health check endpoint.

**Response (200):**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

#### POST `/worktree/create`

Create a new git worktree with a new branch.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "issueId": "Q-3",
  "repoPath": "/home/altan/Code/my-org/mono-repo",
  "branchName": "Q-3-implement-audit-log-endpoint-spec",
  "baseBranch": "main",
  "worktreeRoot": "/home/altan/worktrees",
  "terminalCommand": "ghostty -e 'cd {directory} && opencode'"
}
```

**Response (200) - Success:**
```json
{
  "success": true,
  "directory": "/home/altan/worktrees/mono-repo/Q-3-implement-audit-log-endpoint-spec"
}
```

**Response (409) - Worktree/Branch Exists:**
```json
{
  "error": "exists",
  "directory": "/home/altan/worktrees/mono-repo/Q-3-implement-audit-log-endpoint-spec",
  "message": "Worktree already exists at this location"
}
```

**Response (400) - Bad Request:**
```json
{
  "error": "validation",
  "message": "Missing required field: repoPath"
}
```

**Response (500) - Server Error:**
```json
{
  "error": "git_error",
  "message": "Failed to create worktree: fatal: 'main' is not a valid branch name"
}
```

---

#### POST `/worktree/open`

Open an existing worktree directory in terminal.

**Request Body:**
```json
{
  "directory": "/home/altan/worktrees/mono-repo/Q-3-implement-audit-log-endpoint-spec",
  "terminalCommand": "ghostty -e 'cd {directory} && opencode'",
  "issueId": "Q-3",
  "branchName": "Q-3-implement-audit-log-endpoint-spec"
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Response (400):**
```json
{
  "error": "validation",
  "message": "Directory does not exist"
}
```

---

## Configuration Defaults

```typescript
const DEFAULT_CONFIG: ExtensionConfig = {
  serverUrl: "http://localhost:21547",
  worktreeRoot: "",  // Must be configured by user
  terminalCommand: "ghostty -e 'cd {directory} && opencode'",
  projectMappings: {}
};
```

---

## User Interface Specifications

### Content Script - Worktree Button

**Location:** Injected into Linear's right sidebar, in the Properties section, as a new property row.

**Appearance:**
- Matches Linear's property row styling
- Icon: Git branch icon (SVG)
- Text: "Worktree"
- Hover state matches Linear's hover styling
- Click opens the WorktreeDialog

**Behavior:**
- Only visible on issue detail pages (`/issue/` in URL)
- Re-injects on SPA navigation
- Uses Shadow DOM for style isolation

### Content Script - Worktree Dialog

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Create Worktree                         [X] │
├─────────────────────────────────────────────┤
│                                             │
│ Issue                                       │
│ ┌─────────────────────────────────────────┐ │
│ │ Q-3                                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Repository                                  │
│ ┌─────────────────────────────────────────┐ │
│ │ /home/altan/Code/my-org/repo      [▼]   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Base Branch                                 │
│ ┌─────────────────────────────────────────┐ │
│ │ main                                    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Branch Name                                 │
│ ┌─────────────────────────────────────────┐ │
│ │ Q-3-implement-audit-log-endpoint-spec   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [ ] Save this project mapping               │
│     (shown only if project was unmapped)    │
│                                             │
├─────────────────────────────────────────────┤
│                    [Cancel]  [Create]       │
└─────────────────────────────────────────────┘
```

**States:**
1. **Form** - Default state, shows form fields
2. **Loading** - Shows spinner, disables buttons
3. **Conflict** - Shows existing worktree message with Open/Cancel options
4. **Error** - Shows error message with Dismiss button
5. **Success** - Brief success message, then auto-close

### Content Script - Conflict Dialog

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Worktree Exists                         [X] │
├─────────────────────────────────────────────┤
│                                             │
│ A worktree already exists at:               │
│                                             │
│ /home/altan/worktrees/mono-repo/Q-3-...     │
│                                             │
│ Would you like to open the existing         │
│ worktree?                                   │
│                                             │
├─────────────────────────────────────────────┤
│                [Cancel]  [Open Existing]    │
└─────────────────────────────────────────────┘
```

### Popup - Status Page

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Worktree Extension                          │
├─────────────────────────────────────────────┤
│                                             │
│ Server Status                               │
│ ● Connected                                 │
│   http://localhost:21547                    │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ Configuration                               │
│ Worktree Root: /home/altan/worktrees        │
│ Project Mappings: 3 configured              │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│            [Open Settings]                  │
│                                             │
└─────────────────────────────────────────────┘
```

**Server Status States:**
- `● Connected` (green) - Health check succeeded
- `● Disconnected` (red) - Health check failed
- `● Checking...` (yellow) - Health check in progress

### Popup - Settings Page

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Settings                           [← Back] │
├─────────────────────────────────────────────┤
│                                             │
│ Server URL                                  │
│ ┌─────────────────────────────────────────┐ │
│ │ http://localhost:21547                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Worktree Root Directory                     │
│ ┌─────────────────────────────────────────┐ │
│ │ /home/altan/worktrees                   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Terminal Command                            │
│ ┌─────────────────────────────────────────┐ │
│ │ ghostty -e 'cd {directory} && opencode' │ │
│ └─────────────────────────────────────────┘ │
│ Tokens: {directory}, {issueId}, {branchName}│
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ Project Mappings                            │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Project │ Repo Path       │ Base Branch │ │
│ ├─────────┼─────────────────┼─────────────┤ │
│ │ QUO     │ /home/.../repo  │ main    [x] │ │
│ │ CAP     │ /home/.../repo  │ main    [x] │ │
│ │ NX      │ /home/.../nx    │ master  [x] │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│              [+ Add Mapping]                │
│                                             │
├─────────────────────────────────────────────┤
│                              [Save]         │
└─────────────────────────────────────────────┘
```

---

## Linear URL Parsing

### URL Patterns

**Issue Detail Page:**
```
https://linear.app/{workspace}/issue/{TEAM}-{number}/{slug}
https://linear.app/{workspace}/issue/{TEAM}-{number}
```

**Examples:**
```
https://linear.app/nx/issue/Q-3/implement-audit-log-endpoint-spec
https://linear.app/my-company/issue/ENG-123/fix-login-bug
```

**Extracted Data:**
- `workspace`: `nx` or `my-company`
- `teamCode`: `Q` or `ENG`
- `issueNumber`: `3` or `123`
- `issueId`: `Q-3` or `ENG-123`
- `slug`: `implement-audit-log-endpoint-spec` or `fix-login-bug`

### URL Parsing Logic

```typescript
function parseLinearUrl(url: string): LinearContext | null {
  const pattern = /linear\.app\/([^/]+)\/issue\/([A-Z]+)-(\d+)(?:\/([^/?]+))?/;
  const match = url.match(pattern);
  
  if (!match) return null;
  
  const [, workspace, teamCode, issueNumber, slug] = match;
  
  return {
    issueId: `${teamCode}-${issueNumber}`,
    teamCode,
    issueNumber: parseInt(issueNumber, 10),
    issueTitle: slug ? slugToTitle(slug) : "",
    projectCode: teamCode,  // Use team code as project code
  };
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
```

---

## Branch Name Generation

### Format
```
{IssueID}-{slugified-title}
```

### Rules
1. Preserve issue ID case (e.g., `Q-3` stays `Q-3`)
2. Convert title to lowercase
3. Replace spaces and special characters with hyphens
4. Remove consecutive hyphens
5. Remove leading/trailing hyphens
6. Truncate to max 100 characters (preserving issue ID)

### Implementation

```typescript
function generateBranchName(issueId: string, title: string): string {
  const maxLength = 100;
  
  const slugifiedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")  // Replace non-alphanumeric with hyphen
    .replace(/-+/g, "-")          // Remove consecutive hyphens
    .replace(/^-|-$/g, "");       // Remove leading/trailing hyphens
  
  const fullBranchName = `${issueId}-${slugifiedTitle}`;
  
  if (fullBranchName.length <= maxLength) {
    return fullBranchName;
  }
  
  // Truncate title portion, keeping issue ID
  const availableLength = maxLength - issueId.length - 1; // -1 for hyphen
  const truncatedTitle = slugifiedTitle.slice(0, availableLength).replace(/-$/, "");
  
  return `${issueId}-${truncatedTitle}`;
}
```

---

## Git Operations

### Check if Branch Exists

```bash
git -C {repoPath} show-ref --verify --quiet refs/heads/{branchName}
# Exit code 0 = exists, non-zero = doesn't exist
```

### List Worktrees

```bash
git -C {repoPath} worktree list --porcelain
```

**Output format:**
```
worktree /path/to/main
HEAD abc123...
branch refs/heads/main

worktree /path/to/feature
HEAD def456...
branch refs/heads/feature-branch
```

### Check if Worktree Directory Exists

```typescript
import { exists } from "fs/promises";

async function worktreeExists(directory: string): Promise<boolean> {
  return await exists(directory);
}
```

### Create Worktree with New Branch

```bash
git -C {repoPath} worktree add -b {branchName} {worktreeDirectory} {baseBranch}
```

**Example:**
```bash
git -C /home/altan/Code/my-org/mono-repo worktree add \
  -b Q-3-implement-audit-log-endpoint-spec \
  /home/altan/worktrees/mono-repo/Q-3-implement-audit-log-endpoint-spec \
  main
```

### Worktree Directory Structure

```
{worktreeRoot}/
└── {repoName}/
    └── {branchName}/
        └── ... (worktree contents)
```

**Where:**
- `{worktreeRoot}` = User-configured root (e.g., `/home/altan/worktrees`)
- `{repoName}` = Last segment of repo path (e.g., `mono-repo` from `/home/.../mono-repo`)
- `{branchName}` = Generated branch name (e.g., `Q-3-implement-audit-log-endpoint-spec`)

---

## Terminal Command Execution

### Token Replacement

| Token | Description | Example Value |
|-------|-------------|---------------|
| `{directory}` | Full path to worktree directory | `/home/altan/worktrees/mono-repo/Q-3-...` |
| `{issueId}` | Linear issue ID | `Q-3` |
| `{branchName}` | Git branch name | `Q-3-implement-audit-log-endpoint-spec` |

### Command Execution

```typescript
import { spawn } from "bun";

async function executeTerminalCommand(
  command: string,
  tokens: Record<string, string>
): Promise<void> {
  // Replace tokens
  let finalCommand = command;
  for (const [key, value] of Object.entries(tokens)) {
    finalCommand = finalCommand.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  
  // Parse command (handle quoted arguments)
  const parts = parseCommand(finalCommand);
  const [executable, ...args] = parts;
  
  // Spawn detached process
  spawn({
    cmd: [executable, ...args],
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
}
```

### Default Command

```
ghostty -e 'cd {directory} && opencode'
```

---

## Chrome Extension Manifest

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "Worktree for Linear",
  "version": "1.0.0",
  "description": "Create git worktrees directly from Linear issues",
  
  "permissions": [
    "storage",
    "activeTab"
  ],
  
  "host_permissions": [
    "https://linear.app/*",
    "http://localhost:*/"
  ],
  
  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "background": {
    "service_worker": "background/index.js",
    "type": "module"
  },
  
  "content_scripts": [
    {
      "matches": ["https://linear.app/*"],
      "js": ["content/index.js"],
      "css": [],
      "run_at": "document_idle"
    }
  ],
  
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## Storage Schema

### Chrome Storage (sync)

```typescript
interface StorageSchema {
  config: ExtensionConfig;
}

// Keys
const STORAGE_KEY = "config";
```

### Storage Operations

```typescript
// Get config
async function getConfig(): Promise<ExtensionConfig> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? DEFAULT_CONFIG;
}

// Save config
async function saveConfig(config: ExtensionConfig): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: config });
}

// Update partial config
async function updateConfig(updates: Partial<ExtensionConfig>): Promise<void> {
  const current = await getConfig();
  await saveConfig({ ...current, ...updates });
}

// Add project mapping
async function addProjectMapping(
  projectCode: string,
  mapping: ProjectMapping
): Promise<void> {
  const config = await getConfig();
  config.projectMappings[projectCode] = mapping;
  await saveConfig(config);
}
```

---

## Error Handling

### Server Error Classes

```typescript
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class GitError extends Error {
  constructor(message: string, public stderr?: string) {
    super(message);
    this.name = "GitError";
  }
}

class WorktreeExistsError extends Error {
  constructor(public directory: string) {
    super(`Worktree already exists at ${directory}`);
    this.name = "WorktreeExistsError";
  }
}

class BranchExistsError extends Error {
  constructor(public branchName: string) {
    super(`Branch ${branchName} already exists`);
    this.name = "BranchExistsError";
  }
}
```

### Error Response Mapping

```typescript
function errorToResponse(error: Error): { status: number; body: object } {
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
```

---

## Build Configuration

### Root package.json (Workspace)

```json
{
  "name": "worktree-extension",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "bun run --parallel dev:server dev:extension",
    "dev:server": "bun run --cwd packages/server dev",
    "dev:extension": "bun run --cwd packages/extension dev",
    "build": "bun run build:server && bun run build:extension",
    "build:server": "bun run --cwd packages/server build",
    "build:extension": "bun run --cwd packages/extension build"
  }
}
```

### Extension package.json

```json
{
  "name": "@worktree/extension",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "bun run build.ts --watch",
    "build": "bun run build.ts"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.260",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0"
  }
}
```

### Server package.json

```json
{
  "name": "@worktree/server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "start": "bun run src/index.ts",
    "daemon": "./scripts/daemon.sh"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

### Extension Build Script (build.ts)

```typescript
import { build } from "bun";

async function buildExtension() {
  // Build content script
  await build({
    entrypoints: ["./src/content/index.tsx"],
    outdir: "./dist/content",
    target: "browser",
    format: "esm",
  });
  
  // Build popup
  await build({
    entrypoints: ["./src/popup/index.tsx"],
    outdir: "./dist/popup",
    target: "browser",
    format: "esm",
  });
  
  // Build background service worker
  await build({
    entrypoints: ["./src/background/index.ts"],
    outdir: "./dist/background",
    target: "browser",
    format: "esm",
  });
  
  // Copy static files
  await Bun.write("./dist/manifest.json", Bun.file("./manifest.json"));
  await Bun.write("./dist/popup/index.html", Bun.file("./src/popup/index.html"));
  // Copy icons...
}

buildExtension();
```

---

## Implementation Phases

## Phase 1: Project Setup

- [x] Create root directory structure
- [x] Initialize root package.json with workspace configuration
- [x] Create bunfig.toml for Bun configuration
- [x] Create root tsconfig.json with base TypeScript settings
- [x] Create packages/extension directory
- [x] Create packages/extension/package.json with dependencies
- [x] Create packages/extension/tsconfig.json extending root config
- [x] Create packages/server directory
- [x] Create packages/server/package.json with dependencies
- [x] Create packages/server/tsconfig.json extending root config
- [x] Install all dependencies with `bun install`
- [x] Verify workspace setup works correctly

## Phase 2: Shared Types and Utilities

- [x] Create packages/extension/src/lib/types.ts with all TypeScript interfaces
- [x] Create packages/extension/src/lib/constants.ts with default config values
- [x] Create packages/extension/src/lib/branch-name.ts with branch name generation logic
- [x] Create unit tests for branch name generation (edge cases)
- [x] Create packages/server/src/lib/types.ts with server-specific types
- [ ] Create packages/server/src/lib/errors.ts with custom error classes

## Phase 3: Server - Core Infrastructure

- [ ] Create packages/server/src/index.ts entry point with Bun.serve
- [ ] Create packages/server/src/router.ts with request routing logic
- [ ] Create packages/server/src/middleware/cors.ts for CORS handling
- [ ] Implement CORS middleware to allow requests from chrome-extension:// and https://linear.app
- [ ] Create packages/server/src/routes/health.ts with GET /health endpoint
- [ ] Test health endpoint with curl

## Phase 4: Server - Git Service

- [ ] Create packages/server/src/services/git.ts
- [ ] Implement checkBranchExists() function
- [ ] Implement listWorktrees() function to parse `git worktree list --porcelain`
- [ ] Implement checkWorktreeExists() function (check directory + git status)
- [ ] Implement createWorktree() function with `git worktree add -b`
- [ ] Implement getRepoName() helper to extract repo name from path
- [ ] Implement buildWorktreePath() to construct full worktree directory path
- [ ] Add proper error handling for git command failures
- [ ] Add validation for repo path existence
- [ ] Add validation for base branch existence
- [ ] Test git service functions manually

## Phase 5: Server - Terminal Service

- [ ] Create packages/server/src/services/terminal.ts
- [ ] Implement parseCommand() to handle quoted arguments
- [ ] Implement replaceTokens() for command template processing
- [ ] Implement executeTerminalCommand() with Bun.spawn detached mode
- [ ] Test terminal command execution manually

## Phase 6: Server - Worktree Routes

- [ ] Create packages/server/src/routes/worktree.ts
- [ ] Implement POST /worktree/create endpoint
- [ ] Add request body validation for required fields
- [ ] Integrate git service for worktree creation
- [ ] Handle WorktreeExistsError and return 409 response
- [ ] Handle BranchExistsError with appropriate response
- [ ] Integrate terminal service to open terminal after creation
- [ ] Implement POST /worktree/open endpoint
- [ ] Add request body validation for open endpoint
- [ ] Add directory existence check for open endpoint
- [ ] Integrate terminal service for opening existing worktree
- [ ] Test endpoints with curl/Postman

## Phase 7: Server - Daemon Script

- [ ] Create packages/server/scripts/daemon.sh
- [ ] Add start command with nohup/background execution
- [ ] Add stop command to kill running daemon
- [ ] Add status command to check if daemon is running
- [ ] Add restart command
- [ ] Make script executable
- [ ] Test daemon start/stop functionality

## Phase 8: Extension - Manifest and Build

- [ ] Create packages/extension/manifest.json (Manifest V3)
- [ ] Create packages/extension/build.ts Bun build script
- [ ] Implement content script build configuration
- [ ] Implement popup build configuration
- [ ] Implement background script build configuration
- [ ] Add static file copying (manifest, HTML, icons)
- [ ] Create packages/extension/public/icons directory
- [ ] Create placeholder icons (16, 32, 48, 128px)
- [ ] Create packages/extension/src/popup/index.html
- [ ] Test build script produces correct output structure
- [ ] Test loading unpacked extension in Chrome

## Phase 9: Extension - Storage Layer

- [ ] Create packages/extension/src/lib/storage.ts
- [ ] Implement getConfig() to retrieve from chrome.storage.sync
- [ ] Implement saveConfig() to persist to chrome.storage.sync
- [ ] Implement updateConfig() for partial updates
- [ ] Implement addProjectMapping() helper
- [ ] Implement removeProjectMapping() helper
- [ ] Add type-safe wrapper with default values
- [ ] Test storage operations in extension context

## Phase 10: Extension - API Client

- [ ] Create packages/extension/src/lib/api.ts
- [ ] Implement healthCheck() function
- [ ] Implement createWorktree() function with proper error handling
- [ ] Implement openWorktree() function
- [ ] Add timeout handling for requests
- [ ] Add response parsing and type validation
- [ ] Handle network errors gracefully
- [ ] Test API client against running server

## Phase 11: Extension - Background Service Worker

- [ ] Create packages/extension/src/background/index.ts
- [ ] Set up message listener for content script communication
- [ ] Implement handler for storage operations
- [ ] Implement handler for API calls (to avoid CORS in content script)
- [ ] Add any necessary initialization logic
- [ ] Test background script loads correctly

## Phase 12: Extension - Popup Status Page

- [ ] Create packages/extension/src/popup/index.tsx entry point
- [ ] Create packages/extension/src/popup/App.tsx with router
- [ ] Create packages/extension/src/popup/styles/popup.css base styles
- [ ] Create packages/extension/src/popup/components/Navigation.tsx
- [ ] Create packages/extension/src/popup/components/ServerStatus.tsx
- [ ] Implement health check on popup open
- [ ] Display connected/disconnected status with indicator
- [ ] Create packages/extension/src/popup/pages/Status.tsx
- [ ] Display server URL from config
- [ ] Display worktree root from config
- [ ] Display number of project mappings
- [ ] Add "Open Settings" button with navigation
- [ ] Style popup to match a clean, modern design
- [ ] Test popup renders correctly

## Phase 13: Extension - Popup Settings Page

- [ ] Create packages/extension/src/popup/pages/Settings.tsx
- [ ] Create packages/extension/src/popup/components/Input.tsx styled input
- [ ] Implement server URL input field with validation
- [ ] Implement worktree root directory input field
- [ ] Implement terminal command input field with token help text
- [ ] Create packages/extension/src/popup/components/ProjectMappingRow.tsx
- [ ] Implement project mappings table/list view
- [ ] Implement add new mapping functionality
- [ ] Implement edit existing mapping functionality
- [ ] Implement delete mapping functionality
- [ ] Add form validation for required fields
- [ ] Implement save button with loading state
- [ ] Show success/error feedback on save
- [ ] Add back navigation to status page
- [ ] Test settings save and load correctly
- [ ] Test project mapping CRUD operations

## Phase 14: Extension - Content Script Infrastructure

- [ ] Create packages/extension/src/content/index.tsx entry point
- [ ] Implement Shadow DOM container creation
- [ ] Implement React root mounting in Shadow DOM
- [ ] Create packages/extension/src/content/styles/content.css
- [ ] Implement style injection into Shadow DOM
- [ ] Create packages/extension/src/content/App.tsx root component
- [ ] Create packages/extension/src/content/hooks/useLinearContext.ts
- [ ] Implement URL parsing for Linear issue pages
- [ ] Implement DOM parsing for issue title (fallback)
- [ ] Create packages/extension/src/content/hooks/usePageNavigation.ts
- [ ] Implement URL change detection for SPA navigation
- [ ] Implement MutationObserver for DOM changes
- [ ] Add cleanup on navigation away from issue pages
- [ ] Test content script loads on Linear pages

## Phase 15: Extension - Worktree Button Component

- [ ] Create packages/extension/src/content/components/WorktreeButton.tsx
- [ ] Implement button with git branch icon
- [ ] Style button to match Linear's property row design
- [ ] Implement hover and active states
- [ ] Find correct injection point in Linear's DOM
- [ ] Implement injection logic with MutationObserver
- [ ] Handle re-injection on SPA navigation
- [ ] Add click handler to open dialog
- [ ] Test button appears correctly on issue pages
- [ ] Test button re-appears after navigation

## Phase 16: Extension - Worktree Dialog Component

- [ ] Create packages/extension/src/content/components/WorktreeDialog.tsx
- [ ] Implement modal overlay with backdrop
- [ ] Implement close on backdrop click
- [ ] Implement close on Escape key
- [ ] Create dialog header with title and close button
- [ ] Create issue ID display (read-only)
- [ ] Create repository dropdown with available repos from config
- [ ] Implement auto-selection based on project mapping
- [ ] Create base branch input (from selected repo config)
- [ ] Create branch name input with generated default
- [ ] Implement branch name generation from issue context
- [ ] Create "Save this project mapping" checkbox
- [ ] Show checkbox only when project is unmapped
- [ ] Create Cancel and Create buttons
- [ ] Style dialog to look clean and professional
- [ ] Test dialog opens and closes correctly

## Phase 17: Extension - Dialog State Machine

- [ ] Implement DialogState type handling in dialog
- [ ] Implement "form" state with full form
- [ ] Create packages/extension/src/content/components/LoadingSpinner.tsx
- [ ] Implement "loading" state with spinner and disabled inputs
- [ ] Create packages/extension/src/content/components/ConflictDialog.tsx
- [ ] Implement "conflict" state with existing worktree message
- [ ] Add "Open Existing" and "Cancel" buttons in conflict state
- [ ] Implement "error" state with error message display
- [ ] Add "Dismiss" button in error state
- [ ] Implement "success" state with brief message
- [ ] Add auto-close after success (1-2 seconds)
- [ ] Test all state transitions

## Phase 18: Extension - Dialog API Integration

- [ ] Implement form submission handler
- [ ] Call API client createWorktree() on submit
- [ ] Handle successful response (show success, close)
- [ ] Handle 409 conflict response (show conflict dialog)
- [ ] Handle error responses (show error state)
- [ ] Implement "Open Existing" handler in conflict dialog
- [ ] Call API client openWorktree() for existing
- [ ] Handle open existing success/error
- [ ] Implement "Save this project mapping" logic
- [ ] Save mapping to storage on successful creation
- [ ] Test full create worktree flow end-to-end
- [ ] Test conflict handling flow end-to-end
- [ ] Test error handling displays correctly

## Phase 19: Integration Testing

- [ ] Start server in development mode
- [ ] Load unpacked extension in Chrome
- [ ] Navigate to Linear issue page
- [ ] Verify button appears in correct location
- [ ] Open dialog and verify form is populated correctly
- [ ] Test creating a worktree (with unmapped project)
- [ ] Verify worktree is created on filesystem
- [ ] Verify terminal opens with correct command
- [ ] Verify project mapping is saved
- [ ] Test creating worktree with existing mapping
- [ ] Test conflict handling (try to create existing worktree)
- [ ] Test "Open Existing" opens terminal correctly
- [ ] Test popup status page shows correct info
- [ ] Test popup settings page saves correctly
- [ ] Test settings changes reflect in content script

## Phase 20: Polish and Edge Cases

- [ ] Add form validation feedback (empty fields, invalid paths)
- [ ] Handle case when server is not running (show helpful error)
- [ ] Handle very long issue titles (truncation)
- [ ] Handle special characters in issue titles
- [ ] Handle missing config gracefully in content script
- [ ] Add loading state when fetching config in dialog
- [ ] Improve error messages for common failures
- [ ] Test on different Linear issue page variations
- [ ] Test SPA navigation between issues
- [ ] Test navigation away from issue and back
- [ ] Clean up console logs and debug code
- [ ] Add helpful comments to complex code sections

## Phase 21: Documentation and Finalization

- [ ] Write README.md with project overview
- [ ] Document installation instructions for extension
- [ ] Document server setup and daemon usage
- [ ] Document configuration options
- [ ] Add example configuration
- [ ] Document terminal command tokens
- [ ] Add troubleshooting section
- [ ] Final code review and cleanup
- [ ] Test clean install from scratch
- [ ] Tag version 1.0.0

---

## Future Enhancements (Out of Scope for v1)

- [ ] Extension popup quick-create from current tab
- [ ] Server auto-fetch/pull before creating worktree
- [ ] Multiple worktree roots per repo
- [ ] Custom branch name templates per project
- [ ] System tray indicator for server status
- [ ] Keyboard shortcut to trigger dialog
- [ ] Dark mode support for dialog
- [ ] Import/export settings
- [ ] Server authentication (for shared machines)
- [ ] Auto-cleanup of merged worktrees
