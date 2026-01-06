#!/bin/bash

# Worktree Server Daemon Script
# Usage: ./daemon.sh [start|stop|status|restart]

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
PID_FILE="$SERVER_DIR/.daemon.pid"
LOG_FILE="$SERVER_DIR/.daemon.log"
PORT=21547

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if bun is available
check_bun() {
    if ! command -v bun &> /dev/null; then
        echo -e "${RED}Error: bun is not installed or not in PATH${NC}"
        exit 1
    fi
}

# Check if the server is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Get the PID of the running server
get_pid() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE"
    fi
}

# Start the server
start() {
    check_bun

    if is_running; then
        local pid=$(get_pid)
        echo -e "${YELLOW}Server is already running (PID: $pid)${NC}"
        exit 0
    fi

    echo -n "Starting worktree server... "

    # Start the server in background with nohup
    cd "$SERVER_DIR"
    nohup bun run src/index.ts > "$LOG_FILE" 2>&1 &
    local pid=$!
    
    # Save PID
    echo $pid > "$PID_FILE"

    # Wait a moment and check if it started successfully
    sleep 1

    if is_running; then
        echo -e "${GREEN}OK${NC}"
        echo "Server started on http://localhost:$PORT (PID: $pid)"
        echo "Logs: $LOG_FILE"
    else
        echo -e "${RED}FAILED${NC}"
        echo "Check logs at: $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# Stop the server
stop() {
    if ! is_running; then
        echo -e "${YELLOW}Server is not running${NC}"
        rm -f "$PID_FILE"
        exit 0
    fi

    local pid=$(get_pid)
    echo -n "Stopping worktree server (PID: $pid)... "

    # Send SIGTERM
    kill "$pid" 2>/dev/null

    # Wait for process to stop (max 10 seconds)
    local count=0
    while is_running && [ $count -lt 10 ]; do
        sleep 1
        ((count++))
    done

    if is_running; then
        # Force kill if still running
        echo -n "forcing... "
        kill -9 "$pid" 2>/dev/null
        sleep 1
    fi

    rm -f "$PID_FILE"
    echo -e "${GREEN}OK${NC}"
}

# Show server status
status() {
    if is_running; then
        local pid=$(get_pid)
        echo -e "${GREEN}Server is running${NC} (PID: $pid)"
        echo "URL: http://localhost:$PORT"
        
        # Try to check health endpoint
        if command -v curl &> /dev/null; then
            local health=$(curl -s "http://localhost:$PORT/health" 2>/dev/null)
            if [ -n "$health" ]; then
                echo "Health: $health"
            fi
        fi
    else
        echo -e "${RED}Server is not running${NC}"
        rm -f "$PID_FILE" 2>/dev/null
        exit 1
    fi
}

# Restart the server
restart() {
    echo "Restarting worktree server..."
    stop 2>/dev/null || true
    start
}

# Show usage
usage() {
    echo "Worktree Server Daemon"
    echo ""
    echo "Usage: $0 {start|stop|status|restart}"
    echo ""
    echo "Commands:"
    echo "  start   - Start the server in background"
    echo "  stop    - Stop the running server"
    echo "  status  - Check if server is running"
    echo "  restart - Restart the server"
    echo ""
    echo "Configuration:"
    echo "  Port:     $PORT"
    echo "  PID file: $PID_FILE"
    echo "  Log file: $LOG_FILE"
}

# Main command handler
case "${1:-}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    restart)
        restart
        ;;
    *)
        usage
        exit 1
        ;;
esac
