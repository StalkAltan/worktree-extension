import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  DialogState,
  ExtensionConfig,
  LinearContext,
  ProjectMapping,
} from "../../lib/types";
import { generateBranchName } from "../../lib/branch-name";
import { getConfig, addProjectMapping } from "../../lib/storage";
import {
  createWorktree,
  openWorktree,
  WorktreeExistsError,
  NetworkError,
  ApiError,
} from "../../lib/api";

interface WorktreeDialogProps {
  linearContext: LinearContext;
  dialogState: DialogState;
  onClose: () => void;
  onStateChange: (state: DialogState) => void;
}

/**
 * Close icon SVG
 */
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
    </svg>
  );
}

/**
 * Error icon SVG
 */
function ErrorIcon() {
  return (
    <svg
      className="worktree-error-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

/**
 * Success icon SVG
 */
function SuccessIcon() {
  return (
    <svg
      className="worktree-success-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/**
 * Loading spinner component
 */
function LoadingSpinner() {
  return <div className="worktree-spinner" />;
}

/**
 * Form state for the dialog
 */
interface FormData {
  repoPath: string;
  baseBranch: string;
  branchName: string;
  saveMapping: boolean;
}

/**
 * WorktreeDialog component - Modal dialog for creating worktrees
 */
export function WorktreeDialog({
  linearContext,
  dialogState,
  onClose,
  onStateChange,
}: WorktreeDialogProps) {
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  const [formData, setFormData] = useState<FormData>({
    repoPath: "",
    baseBranch: "main",
    branchName: "",
    saveMapping: false,
  });
  const [configLoading, setConfigLoading] = useState(true);

  // Get the current project mapping if it exists (workspace-aware)
  const projectMapping = useMemo<ProjectMapping | undefined>(() => {
    if (!config) return undefined;
    return config.workspaces?.[linearContext.workspace]?.projectMappings?.[linearContext.projectCode];
  }, [config, linearContext.workspace, linearContext.projectCode]);

  // Check if project is mapped
  const isProjectMapped = !!projectMapping;

  // Get available repositories from current workspace's mappings
  const availableRepos = useMemo<string[]>(() => {
    if (!config) return [];
    const workspaceMappings = config.workspaces?.[linearContext.workspace]?.projectMappings ?? {};
    const repos = new Set<string>();
    Object.values(workspaceMappings).forEach((mapping) => {
      repos.add(mapping.repoPath);
    });
    return Array.from(repos);
  }, [config, linearContext.workspace]);

  // Load configuration when dialog opens
  useEffect(() => {
    if (dialogState.type === "form" || dialogState.type === "closed") {
      setConfigLoading(true);
      getConfig()
        .then((loadedConfig) => {
          setConfig(loadedConfig);

          // Auto-populate form based on project mapping (workspace-aware)
          const mapping = loadedConfig.workspaces?.[linearContext.workspace]?.projectMappings?.[linearContext.projectCode];
          const defaultBranchName = generateBranchName(
            linearContext.issueId,
            linearContext.issueTitle
          );

          if (mapping) {
            setFormData({
              repoPath: mapping.repoPath,
              baseBranch: mapping.baseBranch,
              branchName: defaultBranchName,
              saveMapping: false,
            });
          } else {
            // No mapping - use first available repo from workspace or empty
            const workspaceMappings = loadedConfig.workspaces?.[linearContext.workspace]?.projectMappings ?? {};
            const firstRepo = Object.values(workspaceMappings)[0];
            setFormData({
              repoPath: firstRepo?.repoPath ?? "",
              baseBranch: firstRepo?.baseBranch ?? "main",
              branchName: defaultBranchName,
              saveMapping: false,
            });
          }
        })
        .catch((error) => {
          console.error("Failed to load config:", error);
          onStateChange({ type: "error", message: "Failed to load configuration" });
        })
        .finally(() => {
          setConfigLoading(false);
        });
    }
  }, [dialogState.type, linearContext, onStateChange]);

  // Handle Escape key to close dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dialogState.type !== "loading") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dialogState.type, onClose]);

  // Auto-close on success
  useEffect(() => {
    if (dialogState.type === "success") {
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [dialogState.type, onClose]);

  // Handle form input changes
  const handleInputChange = useCallback(
    (field: keyof FormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!config) return;

    // Validate form
    if (!formData.repoPath) {
      onStateChange({ type: "error", message: "Please select a repository" });
      return;
    }
    if (!formData.branchName) {
      onStateChange({ type: "error", message: "Branch name is required" });
      return;
    }
    if (!config.worktreeRoot) {
      onStateChange({
        type: "error",
        message: "Worktree root directory not configured. Please check settings.",
      });
      return;
    }

    onStateChange({ type: "loading" });

    try {
      // Create worktree
      const result = await createWorktree(
        {
          issueId: linearContext.issueId,
          repoPath: formData.repoPath,
          branchName: formData.branchName,
          baseBranch: formData.baseBranch,
          worktreeRoot: config.worktreeRoot,
          terminalCommand: config.terminalCommand,
        },
        config.serverUrl
      );

      // Save project mapping if checkbox was checked (workspace-aware)
      if (formData.saveMapping && !isProjectMapped) {
        await addProjectMapping(
          linearContext.workspace,
          linearContext.projectCode,
          {
            repoPath: formData.repoPath,
            baseBranch: formData.baseBranch,
          }
        );
      }

      onStateChange({ type: "success", directory: result.directory });
    } catch (error) {
      if (error instanceof WorktreeExistsError) {
        onStateChange({ type: "conflict", directory: error.directory });
      } else if (error instanceof NetworkError) {
        onStateChange({ type: "error", message: error.message });
      } else if (error instanceof ApiError) {
        onStateChange({ type: "error", message: error.message });
      } else {
        onStateChange({
          type: "error",
          message: "An unexpected error occurred",
        });
      }
    }
  }, [config, formData, linearContext, isProjectMapped, onStateChange]);

  // Handle opening existing worktree (from conflict state)
  const handleOpenExisting = useCallback(async () => {
    if (!config || dialogState.type !== "conflict") return;

    onStateChange({ type: "loading" });

    try {
      await openWorktree(
        {
          directory: dialogState.directory,
          terminalCommand: config.terminalCommand,
          issueId: linearContext.issueId,
          branchName: formData.branchName,
        },
        config.serverUrl
      );

      onStateChange({ type: "success", directory: dialogState.directory });
    } catch (error) {
      if (error instanceof NetworkError || error instanceof ApiError) {
        onStateChange({ type: "error", message: error.message });
      } else {
        onStateChange({
          type: "error",
          message: "Failed to open worktree",
        });
      }
    }
  }, [config, dialogState, linearContext.issueId, formData.branchName, onStateChange]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && dialogState.type !== "loading") {
        onClose();
      }
    },
    [dialogState.type, onClose]
  );

  // Don't render if dialog is closed
  if (dialogState.type === "closed") {
    return null;
  }

  // Render loading content
  const renderLoadingContent = () => (
    <div className="worktree-loading-content">
      <LoadingSpinner />
      <span className="worktree-loading-text">Creating worktree...</span>
    </div>
  );

  // Render error content
  const renderErrorContent = () => {
    if (dialogState.type !== "error") return null;
    return (
      <div className="worktree-error-content">
        <ErrorIcon />
        <p className="worktree-error-message">{dialogState.message}</p>
      </div>
    );
  };

  // Render success content
  const renderSuccessContent = () => {
    if (dialogState.type !== "success") return null;
    return (
      <div className="worktree-success-content">
        <SuccessIcon />
        <p className="worktree-success-message">
          Worktree created successfully!
        </p>
      </div>
    );
  };

  // Render conflict content
  const renderConflictContent = () => {
    if (dialogState.type !== "conflict") return null;
    return (
      <div className="worktree-conflict-content">
        <p className="worktree-conflict-message">
          A worktree already exists at:
        </p>
        <div className="worktree-conflict-path">{dialogState.directory}</div>
        <p className="worktree-conflict-message">
          Would you like to open the existing worktree?
        </p>
      </div>
    );
  };

  // Render form content
  const renderFormContent = () => {
    if (configLoading) {
      return (
        <div className="worktree-loading-content">
          <LoadingSpinner />
          <span className="worktree-loading-text">Loading configuration...</span>
        </div>
      );
    }

    return (
      <>
        {/* Issue ID (read-only) */}
        <div className="worktree-form-group">
          <label className="worktree-label">Issue</label>
          <input
            type="text"
            className="worktree-input worktree-input-readonly"
            value={linearContext.issueId}
            readOnly
          />
        </div>

        {/* Repository dropdown */}
        <div className="worktree-form-group">
          <label className="worktree-label">Repository</label>
          {availableRepos.length > 0 ? (
            <select
              className="worktree-select"
              value={formData.repoPath}
              onChange={(e) => handleInputChange("repoPath", e.target.value)}
            >
              {!formData.repoPath && (
                <option value="">Select a repository...</option>
              )}
              {availableRepos.map((repo) => (
                <option key={repo} value={repo}>
                  {repo}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="worktree-input"
              value={formData.repoPath}
              onChange={(e) => handleInputChange("repoPath", e.target.value)}
              placeholder="/path/to/repository"
            />
          )}
        </div>

        {/* Base Branch */}
        <div className="worktree-form-group">
          <label className="worktree-label">Base Branch</label>
          <input
            type="text"
            className="worktree-input"
            value={formData.baseBranch}
            onChange={(e) => handleInputChange("baseBranch", e.target.value)}
            placeholder="main"
          />
        </div>

        {/* Branch Name */}
        <div className="worktree-form-group">
          <label className="worktree-label">Branch Name</label>
          <input
            type="text"
            className="worktree-input"
            value={formData.branchName}
            onChange={(e) => handleInputChange("branchName", e.target.value)}
            placeholder="branch-name"
          />
        </div>

        {/* Save mapping checkbox - only shown if project is unmapped */}
        {!isProjectMapped && formData.repoPath && (
          <div className="worktree-checkbox-group">
            <input
              type="checkbox"
              id="save-mapping"
              className="worktree-checkbox"
              checked={formData.saveMapping}
              onChange={(e) => handleInputChange("saveMapping", e.target.checked)}
            />
            <label htmlFor="save-mapping" className="worktree-checkbox-label">
              Save this project mapping
            </label>
          </div>
        )}
      </>
    );
  };

  // Render footer buttons based on state
  const renderFooter = () => {
    switch (dialogState.type) {
      case "loading":
        return null;

      case "error":
        return (
          <button className="worktree-btn worktree-btn-secondary" onClick={onClose}>
            Dismiss
          </button>
        );

      case "success":
        return null; // Auto-closes

      case "conflict":
        return (
          <>
            <button className="worktree-btn worktree-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="worktree-btn worktree-btn-primary"
              onClick={handleOpenExisting}
            >
              Open Existing
            </button>
          </>
        );

      case "form":
      default:
        return (
          <>
            <button className="worktree-btn worktree-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="worktree-btn worktree-btn-primary"
              onClick={handleSubmit}
              disabled={configLoading || !formData.repoPath || !formData.branchName}
            >
              Create
            </button>
          </>
        );
    }
  };

  // Get dialog title based on state
  const getDialogTitle = () => {
    switch (dialogState.type) {
      case "conflict":
        return "Worktree Exists";
      case "error":
        return "Error";
      case "success":
        return "Success";
      default:
        return "Create Worktree";
    }
  };

  // Render content based on state
  const renderContent = () => {
    switch (dialogState.type) {
      case "loading":
        return renderLoadingContent();
      case "error":
        return renderErrorContent();
      case "success":
        return renderSuccessContent();
      case "conflict":
        return renderConflictContent();
      case "form":
      default:
        return renderFormContent();
    }
  };

  return (
    <div className="worktree-dialog-overlay" onClick={handleBackdropClick}>
      <div className="worktree-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="worktree-dialog-header">
          <h2 className="worktree-dialog-title">{getDialogTitle()}</h2>
          {dialogState.type !== "loading" && (
            <button className="worktree-dialog-close" onClick={onClose}>
              <CloseIcon />
            </button>
          )}
        </div>
        <div className="worktree-dialog-content">{renderContent()}</div>
        {renderFooter() && (
          <div className="worktree-dialog-footer">{renderFooter()}</div>
        )}
      </div>
    </div>
  );
}
