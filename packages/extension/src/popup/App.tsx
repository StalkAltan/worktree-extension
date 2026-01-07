import { useState, useEffect, useCallback } from "react";
import { Navigation } from "./components/Navigation";
import { StatusPage } from "./pages/Status";
import { SettingsPage } from "./pages/Settings";
import { getConfig } from "../lib/storage";
import { healthCheck, NetworkError, ApiError } from "../lib/api";

type Page = "status" | "settings";
export type ServerStatusType = "connected" | "disconnected" | "checking";

export function App() {
  const [page, setPage] = useState<Page>("status");
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatusType>("checking");
  const [serverUrl, setServerUrl] = useState<string>("");

  // Check server health
  const checkServerHealth = useCallback(async (url: string) => {
    if (!url) return;
    
    setServerStatus("checking");
    try {
      await healthCheck(url);
      setServerStatus("connected");
    } catch (error) {
      setServerStatus("disconnected");
      if (error instanceof NetworkError) {
        console.debug("Server unreachable:", error.message);
      } else if (error instanceof ApiError) {
        console.debug("Server error:", error.message);
      }
    }
  }, []);

  // Detect workspace from active tab URL on mount
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url;
      if (url) {
        const match = url.match(/linear\.app\/([^/]+)/);
        if (match) {
          setWorkspace(match[1]);
        }
      }
    });
  }, []);

  // Load config and check server status on mount
  useEffect(() => {
    getConfig().then((config) => {
      setServerUrl(config.serverUrl);
      checkServerHealth(config.serverUrl);
    });
  }, [checkServerHealth]);

  // Re-check server status when serverUrl changes (e.g., after saving settings)
  const handleServerUrlChange = useCallback((newUrl: string) => {
    setServerUrl(newUrl);
    checkServerHealth(newUrl);
  }, [checkServerHealth]);

  return (
    <div className="popup-container">
      <Navigation currentPage={page} onNavigate={setPage} />
      {page === "status" ? (
        <StatusPage 
          onOpenSettings={() => setPage("settings")} 
          workspace={workspace}
          serverStatus={serverStatus}
          onRetryConnection={() => checkServerHealth(serverUrl)}
        />
      ) : (
        <SettingsPage 
          onBack={() => setPage("status")} 
          workspace={workspace}
          serverStatus={serverStatus}
          onServerUrlChange={handleServerUrlChange}
        />
      )}
    </div>
  );
}
