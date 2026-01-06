import { useState, useEffect, useCallback } from "react";
import { healthCheck, NetworkError, ApiError } from "../../lib/api";

export type ServerStatusType = "connected" | "disconnected" | "checking";

interface ServerStatusProps {
  serverUrl: string;
  onStatusChange?: (status: ServerStatusType) => void;
}

/**
 * ServerStatus component displays the connection status to the worktree server.
 * It performs a health check on mount and can be manually refreshed.
 */
export function ServerStatus({ serverUrl, onStatusChange }: ServerStatusProps) {
  const [status, setStatus] = useState<ServerStatusType>("checking");
  const [version, setVersion] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setStatus("checking");
    onStatusChange?.("checking");

    try {
      const response = await healthCheck(serverUrl);
      setStatus("connected");
      setVersion(response.version);
      onStatusChange?.("connected");
    } catch (error) {
      setStatus("disconnected");
      setVersion(null);
      onStatusChange?.("disconnected");

      // Log the error for debugging
      if (error instanceof NetworkError) {
        console.debug("Server unreachable:", error.message);
      } else if (error instanceof ApiError) {
        console.debug("Server error:", error.message);
      }
    }
  }, [serverUrl, onStatusChange]);

  // Check health on mount and when serverUrl changes
  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const statusText = {
    connected: "Connected",
    disconnected: "Disconnected",
    checking: "Checking...",
  };

  return (
    <div className="section">
      <div className="section-title">Server Status</div>
      <div className="status-indicator">
        <span className={`status-dot ${status}`} />
        <span className={`status-text ${status}`}>{statusText[status]}</span>
        {status === "connected" && version && (
          <span className="text-muted" style={{ marginLeft: "auto" }}>
            v{version}
          </span>
        )}
      </div>
      <div className="status-url">{serverUrl}</div>
      {status === "disconnected" && (
        <button
          className="btn-secondary btn-small"
          style={{ marginTop: "8px" }}
          onClick={checkHealth}
        >
          Retry
        </button>
      )}
    </div>
  );
}
