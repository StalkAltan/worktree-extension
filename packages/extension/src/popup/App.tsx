import { useState } from "react";
import { Navigation } from "./components/Navigation";

type Page = "status" | "settings";

export function App() {
  const [page, setPage] = useState<Page>("status");

  return (
    <div className="popup-container">
      <Navigation currentPage={page} onNavigate={setPage} />
      {page === "status" ? (
        <div>
          <p>Status page placeholder</p>
          <button className="btn-primary" onClick={() => setPage("settings")}>
            Open Settings
          </button>
        </div>
      ) : (
        <div>
          <p>Settings page placeholder</p>
        </div>
      )}
    </div>
  );
}
