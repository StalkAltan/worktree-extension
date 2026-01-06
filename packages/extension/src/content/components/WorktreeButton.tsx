import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface WorktreeButtonProps {
  onClick: () => void;
}

/**
 * Git branch icon SVG
 */
function GitBranchIcon() {
  return (
    <svg
      style={{ width: '16px', height: '16px', flexShrink: 0 }}
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"
      />
    </svg>
  );
}

/**
 * Selector for Linear's properties panel where we inject the button.
 * Linear uses a "Properties" section in the issue sidebar with property rows.
 * The structure is typically: aside > div with specific data attributes or classes.
 * 
 * We look for common patterns in Linear's DOM structure.
 */
const SIDEBAR_SELECTORS = [
  // Linear's issue detail panel properties section
  '[data-testid="issue-properties"]',
  '[data-testid="properties-section"]',
  // The aside element that contains issue metadata
  'aside[class*="IssueDetail"]',
  'aside[class*="issue"]',
  // Property list container patterns
  '[class*="PropertyList"]',
  '[class*="PropertiesPanel"]',
  // Generic selectors for the right sidebar
  'aside > div > div:first-child',
] as const;

/**
 * Find the best injection point in Linear's DOM.
 * Returns the element where we should inject our button as the last child.
 */
function findInjectionPoint(): HTMLElement | null {
  // Try each selector in order of specificity
  for (const selector of SIDEBAR_SELECTORS) {
    try {
      const element = document.querySelector(selector);
      if (element && element instanceof HTMLElement) {
        console.log('[Worktree] Found injection point with selector:', selector);
        return element;
      }
    } catch {
      // Invalid selector, skip
      continue;
    }
  }
  
  // Fallback: Look for the sidebar based on common patterns
  // Linear's sidebar typically has properties displayed as rows
  const aside = document.querySelector('aside');
  if (aside) {
    console.log('[Worktree] Found aside element, looking for property section');
    // Look for a scrollable container or property section
    const propertySection = aside.querySelector('[class*="property"], [class*="Property"], [role="group"]');
    if (propertySection instanceof HTMLElement) {
      console.log('[Worktree] Found property section in aside');
      return propertySection;
    }
    
    // If no specific property section, use aside's first div child
    const firstDiv = aside.querySelector(':scope > div');
    if (firstDiv instanceof HTMLElement) {
      console.log('[Worktree] Using aside > div as fallback');
      return firstDiv;
    }
  }
  
  console.log('[Worktree] No injection point found');
  return null;
}

/**
 * WorktreeButton component that injects itself into Linear's sidebar.
 * Uses a MutationObserver to re-inject when the DOM changes.
 */
export function WorktreeButton({ onClick }: WorktreeButtonProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  
  /**
   * Creates and returns the container element for our button.
   * Styled to match Linear's property row appearance.
   */
  const createButtonContainer = useCallback(() => {
    const container = document.createElement("div");
    container.id = "worktree-button-container";
    container.setAttribute("data-worktree-extension", "true");
    
    // Style to match Linear's property row
    container.style.cssText = `
      padding: 6px 12px;
      margin: 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    `;
    
    return container;
  }, []);
  
  /**
   * Attempts to inject the button into Linear's DOM.
   */
  const injectButton = useCallback(() => {
    // Check if already injected
    const existingContainer = document.getElementById("worktree-button-container");
    if (existingContainer) {
      setPortalContainer(existingContainer);
      return;
    }
    
    const injectionPoint = findInjectionPoint();
    if (!injectionPoint) {
      // Will retry via MutationObserver
      return;
    }
    
    const container = createButtonContainer();
    injectionPoint.appendChild(container);
    setPortalContainer(container);
  }, [createButtonContainer]);
  
  /**
   * Removes the button from the DOM.
   */
  const removeButton = useCallback(() => {
    const container = document.getElementById("worktree-button-container");
    if (container) {
      container.remove();
    }
    setPortalContainer(null);
  }, []);
  
  useEffect(() => {
    // Initial injection attempt
    injectButton();
    
    // Set up MutationObserver to handle DOM changes
    const observer = new MutationObserver((mutations) => {
      // Check if our container was removed
      const container = document.getElementById("worktree-button-container");
      if (!container) {
        injectButton();
      }
    });
    
    // Observe the body for changes that might affect the sidebar
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    // Cleanup on unmount
    return () => {
      observer.disconnect();
      removeButton();
    };
  }, [injectButton, removeButton]);
  
  // If we don't have a portal container yet, render nothing
  // The MutationObserver will trigger re-injection when the DOM is ready
  if (!portalContainer) {
    return null;
  }
  
  // Render the button into the portal container using a React portal
  // Using inline styles since this renders outside the shadow DOM
  return createPortal(
    <button
      type="button"
      onClick={onClick}
      title="Create worktree from this issue"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 8px',
        margin: '0',
        background: 'transparent',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '13px',
        color: '#6b6f76',
        width: '100%',
        textAlign: 'left' as const,
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        e.currentTarget.style.color = '#1a1a1a';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = '#6b6f76';
      }}
    >
      <GitBranchIcon />
      <span style={{ flex: 1 }}>Worktree</span>
    </button>,
    portalContainer
  );
}
