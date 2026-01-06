# Worktree for Linear

A Chrome extension that creates git worktrees directly from Linear issue pages, with a local Bun server handling git operations and terminal launching.

## Overview

This extension adds a "Worktree" button to Linear issue pages. Clicking it opens a dialog to create a new git worktree for that issue, automatically generating a branch name from the issue ID and title.

**Components:**
- **Chrome Extension** - Injects UI into Linear, manages settings, communicates with server
- **Local Bun Server** - Handles git worktree operations and terminal spawning

## Installation

### Prerequisites

- [Bun](https://bun.sh/) runtime installed
- Chrome or Chromium-based browser
- Git installed and configured

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd worktree-extension
   bun install
   ```

2. **Build the extension:**
   ```bash
   bun run build:extension
   ```

3. **Load the extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `packages/extension/dist` directory

4. **Start the server:**
   ```bash
   bun run dev:server
   ```

   Or run as a daemon:
   ```bash
   ./packages/server/scripts/daemon.sh start
   ```

## Configuration

Click the extension icon in Chrome to open the popup, then click "Open Settings" to configure:

- **Server URL**: Local server address (default: `http://localhost:21547`)
- **Worktree Root Directory**: Base directory where worktrees will be created (e.g., `/home/user/worktrees`)
- **Terminal Command**: Command to open terminal in the worktree directory

### Terminal Command Tokens

| Token | Description | Example |
|-------|-------------|---------|
| `{directory}` | Full path to worktree | `/home/user/worktrees/repo/Q-3-fix-bug` |
| `{issueId}` | Linear issue ID | `Q-3` |
| `{branchName}` | Git branch name | `Q-3-fix-bug` |

**Example commands:**
```bash
# Ghostty with opencode
ghostty -e bash -c 'cd {directory} && opencode'

# Ghostty with opencode agent mode
ghostty -e bash -c 'cd {directory} && opencode --agent plan --model "anthropic/claude-opus-4-5" --prompt "Create a plan for {issueId}"'

# VS Code
code {directory}

# Terminal.app (macOS)
open -a Terminal {directory}

# GNOME Terminal
gnome-terminal --working-directory={directory}

# Kitty with opencode
kitty bash -c 'cd {directory} && opencode'
```

### Project Mappings

Map Linear team codes to repositories:

| Project | Repo Path | Base Branch |
|---------|-----------|-------------|
| QUO | /home/user/code/quotient | main |
| ENG | /home/user/code/engineering | develop |

## Usage

1. Navigate to a Linear issue page (e.g., `https://linear.app/workspace/issue/Q-3/issue-title`)
2. Find the "Worktree" button in the issue sidebar
3. Click to open the worktree creation dialog
4. Review/modify the branch name if needed
5. Click "Create"

The extension will:
- Create a new git worktree at `{worktreeRoot}/{repoName}/{branchName}`
- Create a new branch based on the configured base branch
- Open your terminal in the new worktree directory

## Development

### Project Structure

```
worktree-extension/
├── packages/
│   ├── extension/          # Chrome Extension (Manifest V3)
│   │   ├── src/
│   │   │   ├── content/    # Content script (injected into Linear)
│   │   │   ├── popup/      # Extension popup UI
│   │   │   ├── background/ # Service worker
│   │   │   └── lib/        # Shared utilities
│   │   └── dist/           # Built extension
│   │
│   └── server/             # Local Bun HTTP server
│       ├── src/
│       │   ├── routes/     # API endpoints
│       │   └── services/   # Git and terminal services
│       └── scripts/        # Daemon scripts
```

### Scripts

```bash
# Development (both server and extension watch mode)
bun run dev

# Build extension only
bun run build:extension

# Build server only
bun run build:server

# Run server
bun run dev:server
```

### Server Daemon

```bash
# Start daemon
./packages/server/scripts/daemon.sh start

# Stop daemon
./packages/server/scripts/daemon.sh stop

# Check status
./packages/server/scripts/daemon.sh status

# Restart daemon
./packages/server/scripts/daemon.sh restart
```

## API Reference

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

### POST /worktree/create

Create a new git worktree.

**Request:**
```json
{
  "issueId": "Q-3",
  "repoPath": "/home/user/code/repo",
  "branchName": "Q-3-fix-bug",
  "baseBranch": "main",
  "worktreeRoot": "/home/user/worktrees",
  "terminalCommand": "ghostty -e bash -c 'cd {directory} && opencode'"
}
```

**Response (200):**
```json
{
  "success": true,
  "directory": "/home/user/worktrees/repo/Q-3-fix-bug"
}
```

**Response (409 - Exists):**
```json
{
  "error": "exists",
  "directory": "/home/user/worktrees/repo/Q-3-fix-bug",
  "message": "Worktree already exists at this location"
}
```

### POST /worktree/open

Open an existing worktree in terminal.

**Request:**
```json
{
  "directory": "/home/user/worktrees/repo/Q-3-fix-bug",
  "terminalCommand": "ghostty -e bash -c 'cd {directory} && opencode'",
  "issueId": "Q-3",
  "branchName": "Q-3-fix-bug"
}
```

**Response (200):**
```json
{
  "success": true
}
```

## Troubleshooting

### Server not connecting

1. Ensure the server is running: `./packages/server/scripts/daemon.sh status`
2. Check the server URL in extension settings matches `http://localhost:21547`
3. Verify no firewall is blocking local connections

### Worktree creation fails

1. Ensure the repository path exists and is a valid git repository
2. Verify the base branch exists
3. Check that the worktree root directory is writable

### Button not appearing on Linear

1. Ensure the extension is enabled in Chrome
2. Try refreshing the Linear page
3. Check browser console for errors

## License

MIT
