import { useState } from "react";

type Page = "status" | "settings";

export function App() {
  const [page, setPage] = useState<Page>("status");

  return (
    <div className="popup-container">
      {page === "status" ? (
        <div>
          <h1>Worktree Extension</h1>
          <p>Status page placeholder</p>
          <button onClick={() => setPage("settings")}>Open Settings</button>
        </div>
      ) : (
        <div>
          <h1>Settings</h1>
          <p>Settings page placeholder</p>
          <button onClick={() => setPage("status")}>Back</button>
        </div>
      )}
    </div>
  );
}
