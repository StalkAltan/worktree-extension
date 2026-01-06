import { useState } from "react";
import { Navigation } from "./components/Navigation";
import { StatusPage } from "./pages/Status";
import { SettingsPage } from "./pages/Settings";

type Page = "status" | "settings";

export function App() {
  const [page, setPage] = useState<Page>("status");

  return (
    <div className="popup-container">
      <Navigation currentPage={page} onNavigate={setPage} />
      {page === "status" ? (
        <StatusPage onOpenSettings={() => setPage("settings")} />
      ) : (
        <SettingsPage onBack={() => setPage("status")} />
      )}
    </div>
  );
}
