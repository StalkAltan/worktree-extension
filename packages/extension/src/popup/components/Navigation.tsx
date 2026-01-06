interface NavigationProps {
  currentPage: "status" | "settings";
  onNavigate: (page: "status" | "settings") => void;
}

function BackArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 12L6 8L10 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Navigation({ currentPage, onNavigate }: NavigationProps) {
  if (currentPage === "status") {
    return (
      <div className="header">
        <h1>Worktree Extension</h1>
      </div>
    );
  }

  return (
    <div className="header">
      <button
        className="back-button"
        onClick={() => onNavigate("status")}
        aria-label="Back to status"
      >
        <BackArrowIcon />
      </button>
      <h1>Settings</h1>
    </div>
  );
}
