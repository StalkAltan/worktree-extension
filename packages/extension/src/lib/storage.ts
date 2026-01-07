import type { ExtensionConfig, ProjectMapping, WorkspaceConfig } from "./types";
import { DEFAULT_CONFIG, STORAGE_KEY } from "./constants";

/**
 * Get the extension configuration from Chrome storage.
 * Returns default config if no config is stored.
 */
export async function getConfig(): Promise<ExtensionConfig> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? DEFAULT_CONFIG;
}

/**
 * Save the entire extension configuration to Chrome storage.
 */
export async function saveConfig(config: ExtensionConfig): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: config });
}

/**
 * Update specific fields of the configuration.
 * Merges updates with existing config.
 */
export async function updateConfig(
  updates: Partial<ExtensionConfig>
): Promise<void> {
  const current = await getConfig();
  await saveConfig({ ...current, ...updates });
}

/**
 * Check if legacy project mappings need to be migrated.
 * @returns true if migration is needed
 */
export async function needsMigration(): Promise<boolean> {
  const config = await getConfig();
  return (
    config.projectMappings !== undefined &&
    Object.keys(config.projectMappings).length > 0
  );
}

/**
 * Migrate legacy project mappings to workspace-aware storage.
 * @param targetWorkspace - The workspace to migrate mappings to
 */
export async function migrateProjectMappings(
  targetWorkspace: string
): Promise<void> {
  const config = await getConfig();

  if (!config.projectMappings || Object.keys(config.projectMappings).length === 0) {
    return;
  }

  // Ensure workspaces object exists
  if (!config.workspaces) {
    config.workspaces = {};
  }

  // Ensure target workspace exists
  if (!config.workspaces[targetWorkspace]) {
    config.workspaces[targetWorkspace] = { projectMappings: {} };
  }

  // Migrate legacy mappings to target workspace
  for (const [projectCode, mapping] of Object.entries(config.projectMappings)) {
    config.workspaces[targetWorkspace].projectMappings[projectCode] = mapping;
  }

  // Clear legacy projectMappings
  delete config.projectMappings;

  await saveConfig(config);
}

/**
 * Get the workspace configuration.
 * @param workspace - The workspace identifier
 * @returns The workspace config or default empty config
 */
export async function getWorkspaceConfig(
  workspace: string
): Promise<WorkspaceConfig> {
  const config = await getConfig();
  return config.workspaces?.[workspace] ?? { projectMappings: {} };
}

/**
 * Add or update a project mapping for a workspace.
 * @param workspace - The workspace identifier
 * @param projectCode - The project code (e.g., "QUO")
 * @param mapping - The mapping configuration
 */
export async function addProjectMapping(
  workspace: string,
  projectCode: string,
  mapping: ProjectMapping
): Promise<void> {
  const config = await getConfig();

  // Ensure workspaces object exists
  if (!config.workspaces) {
    config.workspaces = {};
  }

  // Ensure workspace entry exists
  if (!config.workspaces[workspace]) {
    config.workspaces[workspace] = { projectMappings: {} };
  }

  config.workspaces[workspace].projectMappings[projectCode] = mapping;
  await saveConfig(config);
}

/**
 * Remove a project mapping from a workspace.
 * @param workspace - The workspace identifier
 * @param projectCode - The project code to remove
 */
export async function removeProjectMapping(
  workspace: string,
  projectCode: string
): Promise<void> {
  const config = await getConfig();

  if (config.workspaces?.[workspace]?.projectMappings) {
    delete config.workspaces[workspace].projectMappings[projectCode];
    await saveConfig(config);
  }
}

/**
 * Get a specific project mapping from a workspace.
 * @param workspace - The workspace identifier
 * @param projectCode - The project code to look up
 * @returns The mapping or undefined if not found
 */
export async function getProjectMapping(
  workspace: string,
  projectCode: string
): Promise<ProjectMapping | undefined> {
  const config = await getConfig();
  return config.workspaces?.[workspace]?.projectMappings?.[projectCode];
}
