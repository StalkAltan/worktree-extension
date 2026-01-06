import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";

const CONTAINER_ID = "worktree-extension-container";

let shadowRoot: ShadowRoot | null = null;
let reactRoot: Root | null = null;

/**
 * Creates or retrieves the Shadow DOM container for the extension.
 * This isolates our styles from Linear's page and vice versa.
 */
function getOrCreateContainer(): ShadowRoot {
  // Check if container already exists
  let container = document.getElementById(CONTAINER_ID);
  
  if (!container) {
    // Create host element
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    document.body.appendChild(container);
    
    // Create shadow root
    shadowRoot = container.attachShadow({ mode: "open" });
    
    // Inject styles into shadow DOM
    injectStyles(shadowRoot);
  } else if (!shadowRoot) {
    // Container exists but we don't have reference to shadow root
    shadowRoot = container.shadowRoot;
  }
  
  return shadowRoot!;
}

/**
 * Injects the content script styles into the shadow DOM
 */
function injectStyles(shadow: ShadowRoot): void {
  const style = document.createElement("style");
  style.textContent = getStyles();
  shadow.appendChild(style);
}

/**
 * Returns the CSS styles for the content script.
 * These are embedded directly to avoid loading external files.
 */
function getStyles(): string {
  return `
    /* Reset styles within shadow DOM */
    *, *::before, *::after {
      box-sizing: border-box;
    }
    
    /* Worktree button in Linear sidebar */
    .worktree-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      margin: 0;
      background: transparent;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      color: var(--worktree-text-secondary, #6b6f76);
      width: 100%;
      text-align: left;
      transition: background-color 0.15s ease;
    }
    
    .worktree-button:hover {
      background-color: var(--worktree-hover-bg, rgba(0, 0, 0, 0.05));
      color: var(--worktree-text-primary, #1a1a1a);
    }
    
    .worktree-button-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
    
    .worktree-button-text {
      flex: 1;
    }
    
    /* Dialog overlay */
    .worktree-dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
    }
    
    /* Dialog container */
    .worktree-dialog {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    /* Dialog header */
    .worktree-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e5e5;
    }
    
    .worktree-dialog-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
    }
    
    .worktree-dialog-close {
      background: transparent;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #6b6f76;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .worktree-dialog-close:hover {
      background-color: rgba(0, 0, 0, 0.05);
      color: #1a1a1a;
    }
    
    /* Dialog content */
    .worktree-dialog-content {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }
    
    /* Form fields */
    .worktree-form-group {
      margin-bottom: 16px;
    }
    
    .worktree-form-group:last-child {
      margin-bottom: 0;
    }
    
    .worktree-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #1a1a1a;
      margin-bottom: 6px;
    }
    
    .worktree-input,
    .worktree-select {
      width: 100%;
      padding: 8px 12px;
      font-size: 14px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
      color: #1a1a1a;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    
    .worktree-input:focus,
    .worktree-select:focus {
      outline: none;
      border-color: #5e6ad2;
      box-shadow: 0 0 0 3px rgba(94, 106, 210, 0.15);
    }
    
    .worktree-input:disabled,
    .worktree-select:disabled {
      background: #f3f4f6;
      color: #9ca3af;
      cursor: not-allowed;
    }
    
    .worktree-input-readonly {
      background: #f9fafb;
      color: #6b7280;
    }
    
    /* Checkbox */
    .worktree-checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
    }
    
    .worktree-checkbox {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    
    .worktree-checkbox-label {
      font-size: 13px;
      color: #6b6f76;
      cursor: pointer;
    }
    
    /* Dialog footer */
    .worktree-dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid #e5e5e5;
    }
    
    /* Buttons */
    .worktree-btn {
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .worktree-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .worktree-btn-secondary {
      background: #fff;
      border: 1px solid #d1d5db;
      color: #374151;
    }
    
    .worktree-btn-secondary:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #9ca3af;
    }
    
    .worktree-btn-primary {
      background: #5e6ad2;
      border: 1px solid #5e6ad2;
      color: #fff;
    }
    
    .worktree-btn-primary:hover:not(:disabled) {
      background: #4f5bc7;
      border-color: #4f5bc7;
    }
    
    /* Loading spinner */
    .worktree-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #e5e7eb;
      border-top-color: #5e6ad2;
      border-radius: 50%;
      animation: worktree-spin 0.6s linear infinite;
    }
    
    @keyframes worktree-spin {
      to {
        transform: rotate(360deg);
      }
    }
    
    /* Loading state */
    .worktree-loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      gap: 16px;
    }
    
    .worktree-loading-text {
      font-size: 14px;
      color: #6b6f76;
    }
    
    /* Error state */
    .worktree-error-content {
      text-align: center;
      padding: 20px;
    }
    
    .worktree-error-icon {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      color: #ef4444;
    }
    
    .worktree-error-message {
      font-size: 14px;
      color: #374151;
      margin-bottom: 16px;
    }
    
    /* Success state */
    .worktree-success-content {
      text-align: center;
      padding: 20px;
    }
    
    .worktree-success-icon {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      color: #10b981;
    }
    
    .worktree-success-message {
      font-size: 14px;
      color: #374151;
    }
    
    /* Conflict state */
    .worktree-conflict-content {
      padding: 20px;
    }
    
    .worktree-conflict-message {
      font-size: 14px;
      color: #374151;
      margin-bottom: 12px;
    }
    
    .worktree-conflict-path {
      font-family: monospace;
      font-size: 13px;
      background: #f3f4f6;
      padding: 8px 12px;
      border-radius: 4px;
      word-break: break-all;
      margin-bottom: 16px;
    }
  `;
}

/**
 * Mounts the React application into the Shadow DOM
 */
function mountApp(): void {
  const shadow = getOrCreateContainer();
  
  // Check if already mounted
  if (reactRoot) {
    return;
  }
  
  // Create mount point for React
  let mountPoint = shadow.querySelector("#worktree-app-root") as HTMLElement;
  if (!mountPoint) {
    mountPoint = document.createElement("div");
    mountPoint.id = "worktree-app-root";
    shadow.appendChild(mountPoint);
  }
  
  // Create React root and render
  reactRoot = createRoot(mountPoint);
  reactRoot.render(<App />);
}

/**
 * Unmounts the React application and removes the container
 */
function unmountApp(): void {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  
  const container = document.getElementById(CONTAINER_ID);
  if (container) {
    container.remove();
  }
  
  shadowRoot = null;
}

/**
 * Checks if we're on a Linear issue page
 */
function isLinearIssuePage(): boolean {
  const url = window.location.href;
  return /linear\.app\/[^/]+\/issue\/[A-Z]+-\d+/.test(url);
}

/**
 * Main initialization function
 */
function init(): void {
  if (isLinearIssuePage()) {
    mountApp();
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Listen for URL changes (SPA navigation)
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    
    if (isLinearIssuePage()) {
      mountApp();
    } else {
      unmountApp();
    }
  }
});

// Observe changes to detect navigation
urlObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

// Export for testing
export { mountApp, unmountApp, isLinearIssuePage };
