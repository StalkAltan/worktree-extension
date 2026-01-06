import { useState } from "react";
import type { DialogState } from "../lib/types";
import { useLinearContext } from "./hooks/useLinearContext";
import { usePageNavigation } from "./hooks/usePageNavigation";

/**
 * Root component for the content script.
 * Manages the overall state and coordinates between the button and dialog.
 */
export function App() {
  const [dialogState, setDialogState] = useState<DialogState>({ type: "closed" });
  const linearContext = useLinearContext();
  
  // Re-check context on navigation
  usePageNavigation();
  
  // Don't render anything if we can't get Linear context
  if (!linearContext) {
    return null;
  }
  
  const openDialog = () => {
    setDialogState({ type: "form" });
  };
  
  const closeDialog = () => {
    setDialogState({ type: "closed" });
  };
  
  return (
    <>
      {/* Temporary trigger button - will be replaced by WorktreeButton in Phase 15 */}
      {dialogState.type === "closed" && (
        <button 
          className="worktree-btn worktree-btn-primary"
          onClick={openDialog}
          style={{ 
            position: "fixed", 
            bottom: "20px", 
            right: "20px", 
            zIndex: 999998 
          }}
        >
          Open Worktree Dialog
        </button>
      )}
      
      {/* Placeholder dialog - will be replaced by WorktreeDialog in Phase 16 */}
      {dialogState.type !== "closed" && (
        <div className="worktree-dialog-overlay" onClick={closeDialog}>
          <div className="worktree-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="worktree-dialog-header">
              <h2 className="worktree-dialog-title">Create Worktree</h2>
              <button className="worktree-dialog-close" onClick={closeDialog}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                </svg>
              </button>
            </div>
            <div className="worktree-dialog-content">
              <div className="worktree-form-group">
                <label className="worktree-label">Issue</label>
                <input 
                  type="text" 
                  className="worktree-input worktree-input-readonly" 
                  value={linearContext.issueId} 
                  readOnly 
                />
              </div>
              <div className="worktree-form-group">
                <label className="worktree-label">Issue Title</label>
                <input 
                  type="text" 
                  className="worktree-input worktree-input-readonly" 
                  value={linearContext.issueTitle} 
                  readOnly 
                />
              </div>
              <p style={{ fontSize: "13px", color: "#6b6f76", marginTop: "16px" }}>
                Full dialog implementation coming in Phase 16...
              </p>
            </div>
            <div className="worktree-dialog-footer">
              <button className="worktree-btn worktree-btn-secondary" onClick={closeDialog}>
                Cancel
              </button>
              <button className="worktree-btn worktree-btn-primary" disabled>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
