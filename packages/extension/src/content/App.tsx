import { useState, useCallback } from "react";
import type { DialogState } from "../lib/types";
import { useLinearContext } from "./hooks/useLinearContext";
import { usePageNavigation } from "./hooks/usePageNavigation";
import { WorktreeButton } from "./components/WorktreeButton";
import { WorktreeDialog } from "./components/WorktreeDialog";

/**
 * Root component for the content script.
 * Manages the overall state and coordinates between the button and dialog.
 */
export function App() {
  const [dialogState, setDialogState] = useState<DialogState>({ type: "closed" });
  const linearContext = useLinearContext();
  
  // Re-check context on navigation
  usePageNavigation();
  
  // All hooks must be called before any conditional returns
  const openDialog = useCallback(() => {
    setDialogState({ type: "form" });
  }, []);
  
  const closeDialog = useCallback(() => {
    setDialogState({ type: "closed" });
  }, []);
  
  const handleStateChange = useCallback((state: DialogState) => {
    setDialogState(state);
  }, []);
  
  // Don't render anything if we can't get Linear context
  if (!linearContext) {
    return null;
  }
  
  return (
    <>
      {/* Worktree button injected into Linear's sidebar */}
      <WorktreeButton onClick={openDialog} />
      
      {/* Worktree dialog for creating worktrees */}
      <WorktreeDialog
        linearContext={linearContext}
        dialogState={dialogState}
        onClose={closeDialog}
        onStateChange={handleStateChange}
      />
    </>
  );
}
