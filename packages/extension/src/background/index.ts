/**
 * Background Service Worker for Worktree Extension
 *
 * Handles communication between content scripts and the extension,
 * manages storage operations, and proxies API calls to avoid CORS issues.
 */

import {
  healthCheck,
  createWorktree,
  openWorktree,
  WorktreeExistsError,
  ApiError,
  NetworkError,
} from "../lib/api";
import {
  getConfig,
  saveConfig,
  updateConfig,
  addProjectMapping,
  removeProjectMapping,
  getProjectMapping,
} from "../lib/storage";
import type {
  ExtensionConfig,
  ProjectMapping,
  CreateWorktreeRequest,
  OpenWorktreeRequest,
} from "../lib/types";

// Message types for content script <-> background communication
export type BackgroundMessage =
  | { type: "GET_CONFIG" }
  | { type: "SAVE_CONFIG"; config: ExtensionConfig }
  | { type: "UPDATE_CONFIG"; updates: Partial<ExtensionConfig> }
  | { type: "ADD_PROJECT_MAPPING"; projectCode: string; mapping: ProjectMapping }
  | { type: "REMOVE_PROJECT_MAPPING"; projectCode: string }
  | { type: "GET_PROJECT_MAPPING"; projectCode: string }
  | { type: "HEALTH_CHECK"; serverUrl?: string }
  | { type: "CREATE_WORKTREE"; request: CreateWorktreeRequest; serverUrl?: string }
  | { type: "OPEN_WORKTREE"; request: OpenWorktreeRequest; serverUrl?: string };

// Response types
export type BackgroundResponse =
  | { success: true; data?: unknown }
  | { success: false; error: string; errorType?: string; directory?: string };

/**
 * Handle messages from content scripts or popup
 */
async function handleMessage(
  message: BackgroundMessage
): Promise<BackgroundResponse> {
  try {
    switch (message.type) {
      // Storage operations
      case "GET_CONFIG": {
        const config = await getConfig();
        return { success: true, data: config };
      }

      case "SAVE_CONFIG": {
        await saveConfig(message.config);
        return { success: true };
      }

      case "UPDATE_CONFIG": {
        await updateConfig(message.updates);
        return { success: true };
      }

      case "ADD_PROJECT_MAPPING": {
        await addProjectMapping(message.projectCode, message.mapping);
        return { success: true };
      }

      case "REMOVE_PROJECT_MAPPING": {
        await removeProjectMapping(message.projectCode);
        return { success: true };
      }

      case "GET_PROJECT_MAPPING": {
        const mapping = await getProjectMapping(message.projectCode);
        return { success: true, data: mapping };
      }

      // API operations (proxied to avoid CORS issues in content scripts)
      case "HEALTH_CHECK": {
        const health = await healthCheck(message.serverUrl);
        return { success: true, data: health };
      }

      case "CREATE_WORKTREE": {
        const result = await createWorktree(message.request, message.serverUrl);
        return { success: true, data: result };
      }

      case "OPEN_WORKTREE": {
        const result = await openWorktree(message.request, message.serverUrl);
        return { success: true, data: result };
      }

      default: {
        // Type guard for exhaustiveness
        const _exhaustive: never = message;
        return { success: false, error: `Unknown message type: ${(_exhaustive as BackgroundMessage).type}` };
      }
    }
  } catch (error) {
    // Handle specific error types
    if (error instanceof WorktreeExistsError) {
      return {
        success: false,
        error: error.message,
        errorType: "WorktreeExistsError",
        directory: error.directory,
      };
    }

    if (error instanceof ApiError) {
      return {
        success: false,
        error: error.message,
        errorType: "ApiError",
      };
    }

    if (error instanceof NetworkError) {
      return {
        success: false,
        error: error.message,
        errorType: "NetworkError",
      };
    }

    // Generic error handling
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, error: errorMessage };
  }
}

// Set up message listener
chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: BackgroundResponse) => void
  ) => {
    // Handle the message asynchronously
    handleMessage(message).then(sendResponse);

    // Return true to indicate we will send a response asynchronously
    return true;
  }
);

// Log when service worker is initialized
console.log("[Worktree Extension] Background service worker initialized");
