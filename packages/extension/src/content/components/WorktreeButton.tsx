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
  // Linear's contextual menu container for properties
  '[data-contextual-menu="true"]',
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
 * 
 * Linear's Properties panel structure:
 * [data-contextual-menu="true"] (display: flex)
 * ├── First child div - "Properties" header + copy buttons  
 * └── Second child div - Property rows container (Status, Priority, Assignee, etc.)
 * 
 * We want to inject into the second child (property rows container).
 */
function findInjectionPoint(): HTMLElement | null {
  // First, find the aside (right sidebar) which contains the Properties panel
  const aside = document.querySelector('aside');
  if (!aside) {
    console.log('[Worktree] No aside found');
    return null;
  }
  
  // Find the contextual menu INSIDE the aside (not just any contextual menu on the page)
  const contextualMenu = aside.querySelector('[data-contextual-menu="true"]');
  if (!(contextualMenu instanceof HTMLElement)) {
    console.log('[Worktree] No contextual menu in aside');
    return null;
  }
  
  console.log('[Worktree] Found contextual menu inside aside');
  
  // The contextual menu has display: flex with two children:
  // 1. Header div with "Properties" label and copy buttons
  // 2. Property rows container with Status, Priority, etc.
  // We want the second child (property rows container)
  const children = contextualMenu.querySelectorAll(':scope > div');
  console.log('[Worktree] Contextual menu has', children.length, 'direct children');
  
  if (children.length >= 2) {
    // Second child is the property rows container
    const propertyRowsContainer = children[1];
    if (propertyRowsContainer instanceof HTMLElement) {
      console.log('[Worktree] Using property rows container (second child)');
      return propertyRowsContainer;
    }
  }
  
  // Fallback: look for the container with property buttons
  const propertyButtons = contextualMenu.querySelectorAll('[data-detail-button="true"]');
  if (propertyButtons.length > 0) {
    // Find the common parent of all property buttons
    const firstButton = propertyButtons[0];
    // Navigate up to find the container that's a direct child of contextual menu
    let container = firstButton.parentElement;
    while (container && container.parentElement !== contextualMenu) {
      container = container.parentElement;
    }
    if (container instanceof HTMLElement) {
      console.log('[Worktree] Found property rows container via button traversal');
      return container;
    }
  }
  
  // Last fallback: use the first child if only one exists
  if (children.length === 1 && children[0] instanceof HTMLElement) {
    console.log('[Worktree] Using only child of contextual menu');
    return children[0];
  }
  
  console.log('[Worktree] Using contextual menu directly as fallback');
  return contextualMenu;
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
   * 
   * Linear's property rows have structure:
   * <div class="sc-jCttAn sc-haOJsC ..."> (row container)
   *   <span>Label</span> (optional)
   *   <div> (button wrapper)
   *     <button data-detail-button="true">...</button>
   *   </div>
   * </div>
   */
  const createButtonContainer = useCallback(() => {
    const container = document.createElement("div");
    container.id = "worktree-button-container";
    container.setAttribute("data-worktree-extension", "true");
    
    // Match Linear's property row styling
    // Using similar styles to the existing property rows
    container.style.cssText = `
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 0;
      min-height: 0;
      padding: 0;
      margin-top: 4px;
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
      console.log('[Worktree] Button container already exists');
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
    console.log('[Worktree] Injected button container into:', injectionPoint.tagName, injectionPoint.className);
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
    console.log('[Worktree] No portal container yet');
    return null;
  }

  console.log('[Worktree] Rendering button via portal');
  // Render the button into the portal container using a React portal
  // Using inline styles since this renders outside the shadow DOM
  // Styled to match Linear's property buttons (data-detail-button="true")
  return createPortal(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flex: '1 1 0%',
        minWidth: 0,
      }}
    >
      <div
        data-menu-open="false"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={onClick}
          title="Create worktree from this issue"
          tabIndex={0}
          data-detail-button="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 6px',
            margin: 0,
            marginLeft: '-6px',
            background: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            lineHeight: '20px',
            color: 'inherit',
            fontFamily: 'inherit',
            fontWeight: 'normal',
            textAlign: 'left' as const,
            whiteSpace: 'nowrap',
            minHeight: '24px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <GitBranchIcon />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--color-text-tertiary, #6b6f76)',
            }}
          >
            Create worktree
          </span>
        </button>
      </div>
    </div>,
    portalContainer
  );
}
