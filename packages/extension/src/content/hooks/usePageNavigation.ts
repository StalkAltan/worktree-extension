import { useEffect, useRef } from "react";

/**
 * Hook that detects SPA navigation within Linear.
 * 
 * Linear is a single-page application, so we need to detect navigation
 * through URL changes and DOM mutations rather than page load events.
 */
export function usePageNavigation(onNavigate?: (url: string) => void): void {
  const lastUrlRef = useRef(window.location.href);
  
  useEffect(() => {
    function checkUrlChange() {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrlRef.current) {
        lastUrlRef.current = currentUrl;
        onNavigate?.(currentUrl);
      }
    }
    
    // Listen for popstate (back/forward navigation)
    window.addEventListener("popstate", checkUrlChange);
    
    // Listen for pushstate/replacestate (programmatic navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      checkUrlChange();
    };
    
    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      checkUrlChange();
    };
    
    // Also observe DOM changes as a fallback
    const observer = new MutationObserver(() => {
      checkUrlChange();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    return () => {
      window.removeEventListener("popstate", checkUrlChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      observer.disconnect();
    };
  }, [onNavigate]);
}

/**
 * Checks if the current URL is a Linear issue page.
 */
export function isLinearIssuePage(url: string = window.location.href): boolean {
  return /linear\.app\/[^/]+\/issue\/[A-Z]+-\d+/.test(url);
}
