import { useState, useEffect } from "react";
import { ServerStatus } from "../components/ServerStatus";
import { getConfig } from "../../lib/storage";
import type { ExtensionConfig } from "../../lib/types";
import { DEFAULT_CONFIG } from "../../lib/constants";

interface StatusPageProps {
  onOpenSettings: () => void;
  workspace: string | null;
}

/**
 * Status page component displays server connection status and
 * configuration summary.
 */
export function StatusPage({ onOpenSettings, workspace }: StatusPageProps) {
  const [config, setConfig] = useState<ExtensionConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Count all project mappings across all workspaces, or just for current workspace
  const mappingCount = workspace && config.workspaces[workspace]
    ? Object.keys(config.workspaces[workspace].projectMappings).length
    : Object.values(config.workspaces).reduce(
        (total, ws) => total + Object.keys(ws.projectMappings).length,
        0
      );
  const hasWorktreeRoot = config.worktreeRoot.length > 0;

  // Truncate long paths for display
  const truncatePath = (path: string, maxLength = 30) => {
    if (path.length <= maxLength) return path;
    return "..." + path.slice(-(maxLength - 3));
  };

  if (loading) {
    return (
      <div className="scroll-area">
        <div className="section" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div className="spinner" />
          <span className="text-muted">Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-area">
      <ServerStatus serverUrl={config.serverUrl} />

      <div className="divider" />

      <div className="section">
        <div className="section-title">Configuration</div>
        
        <div className="info-row">
          <span className="info-label">Worktree Root</span>
          <span className="info-value">
            {hasWorktreeRoot ? truncatePath(config.worktreeRoot) : (
              <span style={{ color: "#eab308" }}>Not configured</span>
            )}
          </span>
        </div>
        
        <div className="info-row">
          <span className="info-label">Project Mappings</span>
          <span className="info-value">
            {mappingCount > 0 ? (
              `${mappingCount} configured`
            ) : (
              <span className="text-muted">None</span>
            )}
          </span>
        </div>
      </div>

      <div className="divider" />

      <div className="action-row" style={{ justifyContent: "center" }}>
        <button className="btn-primary" onClick={onOpenSettings}>
          Open Settings
        </button>
      </div>
    </div>
  );
}
