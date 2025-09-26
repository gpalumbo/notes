/**
 * URL Monitor Module
 * Handles URL change detection and page navigation for single-page applications
 */

/* global TIMING */

// URL monitoring state
const URLMonitorState = {
  currentUrl: '',
  isMonitoring: false,
  monitoringInterval: null,
  callbacks: new Set(),
  lastUrlChange: 0
};

// URL monitoring constants
const URL_MONITOR_CONSTANTS = {
  MONITOR_INTERVAL: 2000, // Check URL every 2 seconds
  DEBOUNCE_DELAY: 500, // Debounce URL changes
  MAX_CALLBACKS: 50 // Prevent memory leaks
};

/**
 * Start monitoring URL changes
 * @param {Function} callback - Function to call when URL changes
 */
function startUrlMonitoring(callback) {
  try {
    if (typeof callback === 'function') {
      addUrlChangeCallback(callback);
    }

    if (URLMonitorState.isMonitoring) {
      return; // Already monitoring
    }

    URLMonitorState.currentUrl = window.location.href;
    URLMonitorState.isMonitoring = true;

    // Set up interval monitoring
    URLMonitorState.monitoringInterval = setInterval(() => {
      checkUrlChange();
    }, URL_MONITOR_CONSTANTS.MONITOR_INTERVAL);

    // Listen for browser navigation events
    setupNavigationListeners();

    console.log('[Web Notes] Started URL monitoring');

  } catch (error) {
    console.error('[Web Notes] Error starting URL monitoring:', error);
  }
}

/**
 * Stop monitoring URL changes
 */
function stopUrlMonitoring() {
  try {
    URLMonitorState.isMonitoring = false;

    if (URLMonitorState.monitoringInterval) {
      clearInterval(URLMonitorState.monitoringInterval);
      URLMonitorState.monitoringInterval = null;
    }

    // Remove navigation listeners
    removeNavigationListeners();

    console.log('[Web Notes] Stopped URL monitoring');

  } catch (error) {
    console.error('[Web Notes] Error stopping URL monitoring:', error);
  }
}

/**
 * Add a callback for URL changes
 * @param {Function} callback - Function to call on URL change
 */
function addUrlChangeCallback(callback) {
  try {
    if (typeof callback !== 'function') {
      console.warn('[Web Notes] Invalid callback provided to addUrlChangeCallback');
      return;
    }

    // Prevent too many callbacks
    if (URLMonitorState.callbacks.size >= URL_MONITOR_CONSTANTS.MAX_CALLBACKS) {
      console.warn('[Web Notes] Maximum URL change callbacks reached');
      return;
    }

    URLMonitorState.callbacks.add(callback);

  } catch (error) {
    console.error('[Web Notes] Error adding URL change callback:', error);
  }
}

/**
 * Remove a callback for URL changes
 * @param {Function} callback - Function to remove
 */
function removeUrlChangeCallback(callback) {
  try {
    URLMonitorState.callbacks.delete(callback);
  } catch (error) {
    console.error('[Web Notes] Error removing URL change callback:', error);
  }
}

/**
 * Clear all URL change callbacks
 */
function clearUrlChangeCallbacks() {
  try {
    URLMonitorState.callbacks.clear();
  } catch (error) {
    console.error('[Web Notes] Error clearing URL change callbacks:', error);
  }
}

/**
 * Check if URL has changed and notify callbacks
 */
function checkUrlChange() {
  try {
    const currentUrl = window.location.href;

    if (currentUrl !== URLMonitorState.currentUrl) {
      const oldUrl = URLMonitorState.currentUrl;
      URLMonitorState.currentUrl = currentUrl;
      URLMonitorState.lastUrlChange = Date.now();

      console.log(`[Web Notes] URL changed from ${oldUrl} to ${currentUrl}`);

      // Debounce rapid URL changes
      setTimeout(() => {
        const timeSinceChange = Date.now() - URLMonitorState.lastUrlChange;
        if (timeSinceChange >= URL_MONITOR_CONSTANTS.DEBOUNCE_DELAY) {
          notifyUrlChange(oldUrl, currentUrl);
        }
      }, URL_MONITOR_CONSTANTS.DEBOUNCE_DELAY);
    }

  } catch (error) {
    console.error('[Web Notes] Error checking URL change:', error);
  }
}

/**
 * Notify all callbacks of URL change
 * @param {string} oldUrl - Previous URL
 * @param {string} newUrl - New URL
 */
function notifyUrlChange(oldUrl, newUrl) {
  try {
    URLMonitorState.callbacks.forEach(callback => {
      try {
        callback(oldUrl, newUrl);
      } catch (callbackError) {
        console.error('[Web Notes] Error in URL change callback:', callbackError);
      }
    });

  } catch (error) {
    console.error('[Web Notes] Error notifying URL change:', error);
  }
}

/**
 * Set up navigation event listeners for better URL change detection
 */
function setupNavigationListeners() {
  try {
    // Listen for popstate (back/forward buttons)
    window.addEventListener('popstate', handleNavigationEvent);

    // Listen for pushstate/replacestate (programmatic navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      setTimeout(() => checkUrlChange(), 50); // Small delay to allow DOM updates
      return result;
    };

    history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      setTimeout(() => checkUrlChange(), 50);
      return result;
    };

    // Store original methods for cleanup
    URLMonitorState._originalPushState = originalPushState;
    URLMonitorState._originalReplaceState = originalReplaceState;

    // Listen for hash changes
    window.addEventListener('hashchange', handleNavigationEvent);

    // Listen for DOM mutations that might indicate navigation
    setupMutationObserver();

  } catch (error) {
    console.error('[Web Notes] Error setting up navigation listeners:', error);
  }
}

/**
 * Remove navigation event listeners
 */
function removeNavigationListeners() {
  try {
    window.removeEventListener('popstate', handleNavigationEvent);
    window.removeEventListener('hashchange', handleNavigationEvent);

    // Restore original history methods
    if (URLMonitorState._originalPushState) {
      history.pushState = URLMonitorState._originalPushState;
      delete URLMonitorState._originalPushState;
    }

    if (URLMonitorState._originalReplaceState) {
      history.replaceState = URLMonitorState._originalReplaceState;
      delete URLMonitorState._originalReplaceState;
    }

    // Disconnect mutation observer
    if (URLMonitorState._mutationObserver) {
      URLMonitorState._mutationObserver.disconnect();
      delete URLMonitorState._mutationObserver;
    }

  } catch (error) {
    console.error('[Web Notes] Error removing navigation listeners:', error);
  }
}

/**
 * Handle navigation events
 * @param {Event} event - Navigation event
 */
function handleNavigationEvent(event) {
  try {
    console.log(`[Web Notes] Navigation event detected: ${event.type}`);
    setTimeout(() => checkUrlChange(), 100); // Small delay to allow URL to update
  } catch (error) {
    console.error('[Web Notes] Error handling navigation event:', error);
  }
}

/**
 * Set up mutation observer to detect DOM changes that might indicate navigation
 */
function setupMutationObserver() {
  try {
    if (!window.MutationObserver) {
      return; // Not supported
    }

    const observer = new MutationObserver((mutations) => {
      // Check if there were significant DOM changes that might indicate navigation
      const significantChanges = mutations.some(mutation => {
        // Look for changes to title, head, or major content areas
        return (
          mutation.target === document.title ||
          mutation.target === document.head ||
          (mutation.target.tagName === 'BODY' && mutation.addedNodes.length > 0) ||
          (mutation.target.id && ['main', 'content', 'app', 'root'].includes(mutation.target.id.toLowerCase()))
        );
      });

      if (significantChanges) {
        setTimeout(() => checkUrlChange(), 200);
      }
    });

    // Observe changes to head and body
    observer.observe(document.head || document.documentElement, {
      childList: true,
      subtree: true
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      attributes: true,
      attributeFilter: ['id', 'class']
    });

    URLMonitorState._mutationObserver = observer;

  } catch (error) {
    console.error('[Web Notes] Error setting up mutation observer:', error);
  }
}

/**
 * Get current monitoring status
 * @returns {boolean} True if monitoring is active
 */
function isMonitoring() {
  return URLMonitorState.isMonitoring;
}

/**
 * Get current URL being monitored
 * @returns {string} Current URL
 */
function getCurrentUrl() {
  return URLMonitorState.currentUrl;
}

/**
 * Get number of registered callbacks
 * @returns {number} Number of callbacks
 */
function getCallbackCount() {
  return URLMonitorState.callbacks.size;
}

/**
 * Force a URL check (useful for testing or immediate checks)
 */
function forceUrlCheck() {
  try {
    checkUrlChange();
  } catch (error) {
    console.error('[Web Notes] Error forcing URL check:', error);
  }
}

/**
 * Check if URL has changed since last check (without triggering callbacks)
 * @returns {boolean} True if URL has changed
 */
function hasUrlChanged() {
  try {
    return window.location.href !== URLMonitorState.currentUrl;
  } catch (error) {
    console.error('[Web Notes] Error checking if URL changed:', error);
    return false;
  }
}

/**
 * Update the stored current URL without triggering callbacks
 * @param {string} url - URL to set as current
 */
function setCurrentUrl(url) {
  try {
    URLMonitorState.currentUrl = url;
  } catch (error) {
    console.error('[Web Notes] Error setting current URL:', error);
  }
}

/**
 * Get monitoring statistics
 * @returns {Object} Statistics object
 */
function getMonitoringStats() {
  return {
    isMonitoring: URLMonitorState.isMonitoring,
    currentUrl: URLMonitorState.currentUrl,
    callbackCount: URLMonitorState.callbacks.size,
    lastUrlChange: URLMonitorState.lastUrlChange,
    intervalId: URLMonitorState.monitoringInterval
  };
}

// Export functions for use by other modules
window.URLMonitor = {
  // Core monitoring functions
  startUrlMonitoring,
  stopUrlMonitoring,
  forceUrlCheck,

  // Callback management
  addUrlChangeCallback,
  removeUrlChangeCallback,
  clearUrlChangeCallbacks,

  // State queries
  isMonitoring,
  getCurrentUrl,
  hasUrlChanged,
  getCallbackCount,
  getMonitoringStats,

  // Manual control
  setCurrentUrl,

  // Constants
  URL_MONITOR_CONSTANTS
};