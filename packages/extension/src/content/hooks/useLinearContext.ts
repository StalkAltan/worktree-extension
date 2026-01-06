import { useState, useEffect } from "react";
import type { LinearContext } from "../../lib/types";

/**
 * Parses the Linear URL to extract issue context.
 * 
 * URL patterns:
 * - https://linear.app/{workspace}/issue/{TEAM}-{number}/{slug}
 * - https://linear.app/{workspace}/issue/{TEAM}-{number}
 */
function parseLinearUrl(url: string): LinearContext | null {
  const pattern = /linear\.app\/([^/]+)\/issue\/([A-Z]+)-(\d+)(?:\/([^/?]+))?/;
  const match = url.match(pattern);
  
  if (!match) {
    return null;
  }
  
  const [, _workspace, teamCode, issueNumber, slug] = match;
  
  return {
    issueId: `${teamCode}-${issueNumber}`,
    teamCode,
    issueNumber: parseInt(issueNumber, 10),
    issueTitle: slug ? slugToTitle(slug) : "",
    projectCode: teamCode, // Use team code as project code by default
  };
}

/**
 * Converts a URL slug to a title.
 * Example: "implement-audit-log-endpoint-spec" -> "Implement Audit Log Endpoint Spec"
 */
function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Attempts to get the issue title from the DOM.
 * Falls back to URL slug if DOM parsing fails.
 */
function getTitleFromDOM(): string | null {
  // Try to find the issue title in Linear's DOM
  // Linear typically renders the title in an h1 or specific data attribute
  
  // Try finding by common selectors Linear uses
  const selectors = [
    '[data-testid="issue-title"]',
    'h1[class*="IssueTitle"]',
    '.issue-title h1',
    'main h1',
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      return element.textContent.trim();
    }
  }
  
  return null;
}

/**
 * Hook that extracts Linear issue context from the current page.
 * Combines URL parsing with DOM inspection for more accurate data.
 */
export function useLinearContext(): LinearContext | null {
  const [context, setContext] = useState<LinearContext | null>(null);
  
  useEffect(() => {
    function updateContext() {
      const urlContext = parseLinearUrl(window.location.href);
      
      if (!urlContext) {
        setContext(null);
        return;
      }
      
      // Try to get a better title from DOM
      const domTitle = getTitleFromDOM();
      if (domTitle) {
        urlContext.issueTitle = domTitle;
      }
      
      setContext(urlContext);
    }
    
    // Initial parse
    updateContext();
    
    // Re-parse when DOM changes (for when title loads after navigation)
    const observer = new MutationObserver(() => {
      // Debounce the update
      requestAnimationFrame(updateContext);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  return context;
}

// Export utilities for testing
export { parseLinearUrl, slugToTitle, getTitleFromDOM };
