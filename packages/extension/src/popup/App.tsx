import { useState } from "react";
import { Navigation } from "./components/Navigation";
import { StatusPage } from "./pages/Status";

type Page = "status" | "settings";

export function App() {
  const [page, setPage] = useState<Page>("status");

  return (
    <div className="popup-container">
      <Navigation currentPage={page} onNavigate={setPage} />
      {page === "status" ? (
        <StatusPage onOpenSettings={() => setPage("settings")} />
      ) : (
        <div>
          <p>Settings page placeholder</p>
        </div>
      )}
    </div>
  );
}
