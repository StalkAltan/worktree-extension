import type { ExtensionConfig, ProjectMapping } from "./types";
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
 * Add or update a project mapping.
 * @param projectCode - The project code (e.g., "QUO")
 * @param mapping - The mapping configuration
 */
export async function addProjectMapping(
  projectCode: string,
  mapping: ProjectMapping
): Promise<void> {
  const config = await getConfig();
  config.projectMappings[projectCode] = mapping;
  await saveConfig(config);
}

/**
 * Remove a project mapping.
 * @param projectCode - The project code to remove
 */
export async function removeProjectMapping(projectCode: string): Promise<void> {
  const config = await getConfig();
  delete config.projectMappings[projectCode];
  await saveConfig(config);
}

/**
 * Get a specific project mapping.
 * @param projectCode - The project code to look up
 * @returns The mapping or undefined if not found
 */
export async function getProjectMapping(
  projectCode: string
): Promise<ProjectMapping | undefined> {
  const config = await getConfig();
  return config.projectMappings[projectCode];
}
