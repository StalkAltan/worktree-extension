import { useState, useEffect, useCallback } from "react";
import { getConfig, saveConfig } from "../../lib/storage";
import type { ExtensionConfig, ProjectMapping } from "../../lib/types";
import { DEFAULT_CONFIG } from "../../lib/constants";

interface SettingsPageProps {
  onBack: () => void;
  workspace: string | null; // null = not on Linear
}

interface ProjectMappingEntry {
  projectCode: string;
  repoPath: string;
  baseBranch: string;
}

function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.5 1.5L12.5 3.5M1 13L1.5 10.5L10 2L12 4L3.5 12.5L1 13Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M11 3.5L3 11.5M3 3.5L11 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 2V12M2 7H12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 7V11M8 5V5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Settings page component for configuring the extension.
 * Allows editing server URL, worktree root, terminal command, and project mappings.
 * Project mappings are workspace-aware when workspace is provided.
 */
export function SettingsPage({ onBack, workspace }: SettingsPageProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Form state for global settings
  const [serverUrl, setServerUrl] = useState("");
  const [worktreeRoot, setWorktreeRoot] = useState("");
  const [terminalCommand, setTerminalCommand] = useState("");
  
  // Workspace-specific mappings
  const [mappings, setMappings] = useState<ProjectMappingEntry[]>([]);
  
  // Migration state
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  
  // New mapping form state
  const [newMapping, setNewMapping] = useState<ProjectMappingEntry>({
    projectCode: "",
    repoPath: "",
    baseBranch: "main",
  });
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Edit mapping state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editMapping, setEditMapping] = useState<ProjectMappingEntry>({
    projectCode: "",
    repoPath: "",
    baseBranch: "main",
  });

  // Load config
  const loadConfig = useCallback(async () => {
    try {
      const config = await getConfig();
      setServerUrl(config.serverUrl);
      setWorktreeRoot(config.worktreeRoot);
      setTerminalCommand(config.terminalCommand);
      
      // Load workspace-specific mappings if workspace is set
      if (workspace) {
        const workspaceMappings = config.workspaces?.[workspace]?.projectMappings ?? {};
        const mappingEntries = Object.entries(workspaceMappings).map(
          ([projectCode, mapping]) => ({
            projectCode,
            repoPath: mapping.repoPath,
            baseBranch: mapping.baseBranch,
          })
        );
        setMappings(mappingEntries);
      } else {
        setMappings([]);
      }
    } catch (err) {
      console.error("Failed to load config:", err);
      setMessage({ type: "error", text: "Failed to load settings" });
    }
  }, [workspace]);

  // Load config on mount
  useEffect(() => {
    loadConfig().finally(() => setLoading(false));
  }, [loadConfig]);

  // Check for migration on mount when workspace is set
  useEffect(() => {
    if (workspace) {
      chrome.runtime.sendMessage({ type: "NEEDS_MIGRATION" }, (response) => {
        if (response?.success && response.data) {
          setShowMigrationPrompt(true);
        }
      });
    }
  }, [workspace]);

  // Clear message after a delay
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleMigrate = useCallback(() => {
    if (!workspace) return;
    
    chrome.runtime.sendMessage(
      { type: "MIGRATE_PROJECT_MAPPINGS", workspace },
      () => {
        loadConfig();
        setShowMigrationPrompt(false);
        setMessage({ type: "success", text: "Project mappings migrated successfully" });
      }
    );
  }, [workspace, loadConfig]);

  const handleSaveGlobalSettings = useCallback(async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Validate required fields
      if (!serverUrl.trim()) {
        setMessage({ type: "error", text: "Server URL is required" });
        setSaving(false);
        return;
      }

      // Get current config to preserve workspace mappings
      const currentConfig = await getConfig();
      
      const config: ExtensionConfig = {
        ...currentConfig,
        serverUrl: serverUrl.trim(),
        worktreeRoot: worktreeRoot.trim(),
        terminalCommand: terminalCommand.trim() || DEFAULT_CONFIG.terminalCommand,
      };

      await saveConfig(config);
      setMessage({ type: "success", text: "Settings saved successfully" });
    } catch (err) {
      console.error("Failed to save config:", err);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  }, [serverUrl, worktreeRoot, terminalCommand]);

  const handleDeleteMapping = useCallback((index: number) => {
    if (!workspace) return;
    
    const mapping = mappings[index];
    chrome.runtime.sendMessage(
      {
        type: "REMOVE_PROJECT_MAPPING",
        workspace,
        projectCode: mapping.projectCode,
      },
      (response) => {
        if (response?.success) {
          setMappings((prev) => prev.filter((_, i) => i !== index));
        } else {
          setMessage({ type: "error", text: "Failed to remove mapping" });
        }
      }
    );
  }, [workspace, mappings]);

  const handleStartEdit = useCallback((index: number) => {
    const mapping = mappings[index];
    setEditMapping({
      projectCode: mapping.projectCode,
      repoPath: mapping.repoPath,
      baseBranch: mapping.baseBranch,
    });
    setEditingIndex(index);
    setShowAddForm(false);
  }, [mappings]);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditMapping({ projectCode: "", repoPath: "", baseBranch: "main" });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null || !workspace) return;
    
    if (!editMapping.repoPath.trim()) {
      setMessage({ type: "error", text: "Repository path is required" });
      return;
    }

    const originalCode = mappings[editingIndex].projectCode;
    const newCode = editMapping.projectCode.trim() || originalCode;

    // Check for duplicate project code (excluding current row)
    if (
      newCode !== originalCode &&
      mappings.some((m, i) => i !== editingIndex && m.projectCode === newCode)
    ) {
      setMessage({ type: "error", text: "Project code already exists" });
      return;
    }

    const newMappingData: ProjectMapping = {
      repoPath: editMapping.repoPath.trim(),
      baseBranch: editMapping.baseBranch.trim() || "main",
    };

    // If project code changed, remove old and add new
    if (newCode !== originalCode) {
      chrome.runtime.sendMessage(
        { type: "REMOVE_PROJECT_MAPPING", workspace, projectCode: originalCode },
        () => {
          chrome.runtime.sendMessage(
            {
              type: "ADD_PROJECT_MAPPING",
              workspace,
              projectCode: newCode,
              mapping: newMappingData,
            },
            (response) => {
              if (response?.success) {
                setMappings((prev) =>
                  prev.map((m, i) =>
                    i === editingIndex
                      ? { projectCode: newCode, ...newMappingData }
                      : m
                  )
                );
                setEditingIndex(null);
                setEditMapping({ projectCode: "", repoPath: "", baseBranch: "main" });
              } else {
                setMessage({ type: "error", text: "Failed to update mapping" });
              }
            }
          );
        }
      );
    } else {
      chrome.runtime.sendMessage(
        {
          type: "ADD_PROJECT_MAPPING",
          workspace,
          projectCode: newCode,
          mapping: newMappingData,
        },
        (response) => {
          if (response?.success) {
            setMappings((prev) =>
              prev.map((m, i) =>
                i === editingIndex
                  ? { projectCode: newCode, ...newMappingData }
                  : m
              )
            );
            setEditingIndex(null);
            setEditMapping({ projectCode: "", repoPath: "", baseBranch: "main" });
          } else {
            setMessage({ type: "error", text: "Failed to update mapping" });
          }
        }
      );
    }
  }, [editingIndex, editMapping, mappings, workspace]);

  const handleAddMapping = useCallback(() => {
    if (!workspace) return;
    
    if (!newMapping.projectCode.trim()) {
      setMessage({ type: "error", text: "Project code is required" });
      return;
    }
    if (!newMapping.repoPath.trim()) {
      setMessage({ type: "error", text: "Repository path is required" });
      return;
    }

    // Check for duplicate project code
    if (mappings.some((m) => m.projectCode === newMapping.projectCode.trim())) {
      setMessage({ type: "error", text: "Project code already exists" });
      return;
    }

    const mappingData: ProjectMapping = {
      repoPath: newMapping.repoPath.trim(),
      baseBranch: newMapping.baseBranch.trim() || "main",
    };

    chrome.runtime.sendMessage(
      {
        type: "ADD_PROJECT_MAPPING",
        workspace,
        projectCode: newMapping.projectCode.trim(),
        mapping: mappingData,
      },
      (response) => {
        if (response?.success) {
          setMappings((prev) => [
            ...prev,
            {
              projectCode: newMapping.projectCode.trim(),
              ...mappingData,
            },
          ]);
          setNewMapping({ projectCode: "", repoPath: "", baseBranch: "main" });
          setShowAddForm(false);
        } else {
          setMessage({ type: "error", text: "Failed to add mapping" });
        }
      }
    );
  }, [newMapping, mappings, workspace]);

  if (loading) {
    return (
      <div className="scroll-area">
        <div className="section" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div className="spinner" />
          <span className="text-muted">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-area">
      {message && (
        <div className={`message message-${message.type}`} style={{ marginBottom: "16px" }}>
          {message.text}
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="serverUrl">
          Server URL
        </label>
        <input
          id="serverUrl"
          type="url"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="http://localhost:21547"
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="worktreeRoot">
          Worktree Root Directory
        </label>
        <input
          id="worktreeRoot"
          type="text"
          value={worktreeRoot}
          onChange={(e) => setWorktreeRoot(e.target.value)}
          placeholder="/home/user/worktrees"
        />
        <div className="form-help">
          Base directory where worktrees will be created
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="terminalCommand">
          Terminal Command
        </label>
        <input
          id="terminalCommand"
          type="text"
          value={terminalCommand}
          onChange={(e) => setTerminalCommand(e.target.value)}
          placeholder="ghostty -e 'cd {directory} && opencode'"
        />
        <div className="form-help">
          Tokens: {"{directory}"}, {"{issueId}"}, {"{branchName}"}
        </div>
      </div>

      <div className="divider" />

      {/* Project Mappings Section */}
      <div className="section">
        {workspace ? (
          <>
            <div className="section-title">
              Project Mappings for <strong>{workspace}</strong>
            </div>

            {/* Migration prompt */}
            {showMigrationPrompt && (
              <div
                className="card"
                style={{
                  marginBottom: "12px",
                  backgroundColor: "rgba(var(--color-accent-rgb), 0.1)",
                  border: "1px solid rgba(var(--color-accent-rgb), 0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <InfoIcon />
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: "8px" }}>
                      Existing project mappings need to be assigned to a workspace.
                    </div>
                    <button
                      className="btn-primary btn-small"
                      onClick={handleMigrate}
                    >
                      Assign to "{workspace}"
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mappings.length > 0 ? (
              <div className="card" style={{ padding: 0, marginBottom: "12px" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Repo Path</th>
                      <th>Base</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((mapping, index) => (
                      <tr key={mapping.projectCode}>
                        {editingIndex === index ? (
                          <>
                            <td>
                              <input
                                type="text"
                                value={editMapping.projectCode}
                                onChange={(e) =>
                                  setEditMapping((prev) => ({ ...prev, projectCode: e.target.value }))
                                }
                                style={{ width: "60px", padding: "4px 8px", fontSize: "13px" }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editMapping.repoPath}
                                onChange={(e) =>
                                  setEditMapping((prev) => ({ ...prev, repoPath: e.target.value }))
                                }
                                style={{ width: "100%", padding: "4px 8px", fontSize: "13px" }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editMapping.baseBranch}
                                onChange={(e) =>
                                  setEditMapping((prev) => ({ ...prev, baseBranch: e.target.value }))
                                }
                                style={{ width: "60px", padding: "4px 8px", fontSize: "13px" }}
                              />
                            </td>
                            <td style={{ width: "70px", textAlign: "center" }}>
                              <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                                <button
                                  className="btn-secondary btn-small"
                                  onClick={handleCancelEdit}
                                  style={{ padding: "4px 8px", fontSize: "11px" }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn-primary btn-small"
                                  onClick={handleSaveEdit}
                                  style={{ padding: "4px 8px", fontSize: "11px" }}
                                >
                                  Save
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ fontWeight: 500 }}>{mapping.projectCode}</td>
                            <td
                              style={{
                                maxWidth: "120px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={mapping.repoPath}
                            >
                              {mapping.repoPath}
                            </td>
                            <td>{mapping.baseBranch}</td>
                            <td style={{ width: "70px", textAlign: "center" }}>
                              <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                                <button
                                  className="btn-edit"
                                  onClick={() => handleStartEdit(index)}
                                  aria-label={`Edit ${mapping.projectCode}`}
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className="btn-delete"
                                  onClick={() => handleDeleteMapping(index)}
                                  aria-label={`Delete ${mapping.projectCode}`}
                                >
                                  <DeleteIcon />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !showMigrationPrompt ? (
              /* Empty state for new workspace */
              <div
                className="card"
                style={{
                  marginBottom: "12px",
                  textAlign: "center",
                  padding: "24px 16px",
                }}
              >
                <div className="text-muted" style={{ marginBottom: "12px" }}>
                  No project mappings for this workspace yet.
                </div>
                <button
                  className="btn-primary btn-small btn-icon"
                  onClick={() => setShowAddForm(true)}
                >
                  <PlusIcon />
                  Add Your First Mapping
                </button>
              </div>
            ) : null}

            {showAddForm ? (
              <div className="card">
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label className="form-label" htmlFor="newProjectCode">
                    Project Code
                  </label>
                  <input
                    id="newProjectCode"
                    type="text"
                    value={newMapping.projectCode}
                    onChange={(e) =>
                      setNewMapping((prev) => ({ ...prev, projectCode: e.target.value }))
                    }
                    placeholder="QUO"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label className="form-label" htmlFor="newRepoPath">
                    Repository Path
                  </label>
                  <input
                    id="newRepoPath"
                    type="text"
                    value={newMapping.repoPath}
                    onChange={(e) =>
                      setNewMapping((prev) => ({ ...prev, repoPath: e.target.value }))
                    }
                    placeholder="/home/user/code/repo"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label className="form-label" htmlFor="newBaseBranch">
                    Base Branch
                  </label>
                  <input
                    id="newBaseBranch"
                    type="text"
                    value={newMapping.baseBranch}
                    onChange={(e) =>
                      setNewMapping((prev) => ({ ...prev, baseBranch: e.target.value }))
                    }
                    placeholder="main"
                  />
                </div>
                <div className="action-row" style={{ marginTop: "12px" }}>
                  <button
                    className="btn-secondary btn-small"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewMapping({ projectCode: "", repoPath: "", baseBranch: "main" });
                    }}
                  >
                    Cancel
                  </button>
                  <button className="btn-primary btn-small" onClick={handleAddMapping}>
                    Add
                  </button>
                </div>
              </div>
            ) : mappings.length > 0 ? (
              <button
                className="btn-secondary btn-small btn-icon"
                onClick={() => setShowAddForm(true)}
              >
                <PlusIcon />
                Add Mapping
              </button>
            ) : null}
          </>
        ) : (
          /* Not on Linear state */
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "24px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "8px" }}>
              <InfoIcon />
              <span className="text-muted">Navigate to Linear to configure workspace settings</span>
            </div>
            <div className="form-help">
              Project mappings are configured per-workspace
            </div>
          </div>
        )}
      </div>

      <div className="divider" />

      <div className="action-row">
        <button className="btn-primary" onClick={handleSaveGlobalSettings} disabled={saving}>
          {saving ? (
            <>
              <div className="spinner" style={{ width: "14px", height: "14px" }} />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
