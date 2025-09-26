/**
 * DOM Selectors Module
 * Handles CSS and XPath selector generation, element finding, and DOM utilities
 */

/* global validateXPath */

// Element cache for performance optimization
const elementCache = new Map();
const CACHE_SIZE_LIMIT = 500;

/**
 * Debounce function to limit rapid calls
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Find element using CSS selector or XPath with caching and fallback
 * @param {Object} selector - Selector object with css and xpath properties
 * @returns {Element|null} Found element or null
 */
function findElementBySelector(selector) {
  try {
    if (!selector) {
      return null;
    }

    // Generate cache key
    const cacheKey = `${selector.css || ''}_${selector.xpath || ''}`;

    // Check cache first
    if (elementCache.has(cacheKey)) {
      const cachedElement = elementCache.get(cacheKey);
      if (cachedElement && document.contains(cachedElement)) {
        return cachedElement;
      } else {
        // Remove stale cache entry
        elementCache.delete(cacheKey);
      }
    }

    let element = null;

    // Try CSS selector first (more reliable and faster)
    if (selector.css) {
      try {
        element = document.querySelector(selector.css);
        if (element) {
          cacheElement(cacheKey, element);
          return element;
        }
      } catch (cssError) {
        console.warn('[Web Notes] CSS selector failed:', selector.css, cssError);
      }
    }

    // Fallback to XPath if CSS fails
    if (selector.xpath && validateXPath(selector.xpath)) {
      try {
        const result = document.evaluate(
          selector.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        element = result.singleNodeValue;
        if (element) {
          cacheElement(cacheKey, element);
          return element;
        }
      } catch (xpathError) {
        console.warn('[Web Notes] XPath selector failed:', selector.xpath, xpathError);
      }
    }

    return null;

  } catch (error) {
    console.error('[Web Notes] Error finding element by selector:', error);
    return null;
  }
}

/**
 * Cache element with size management
 * @param {string} key - Cache key
 * @param {Element} element - Element to cache
 */
function cacheElement(key, element) {
  try {
    // Manage cache size
    if (elementCache.size >= CACHE_SIZE_LIMIT) {
      // Remove oldest entries (first 25% of cache)
      const entriesToRemove = Math.floor(CACHE_SIZE_LIMIT * 0.25);
      const keys = Array.from(elementCache.keys()).slice(0, entriesToRemove);
      keys.forEach(k => elementCache.delete(k));
    }

    elementCache.set(key, element);
  } catch (error) {
    console.error('[Web Notes] Error caching element:', error);
  }
}

/**
 * Find text node within an element at specific offset
 * @param {Element} element - Container element
 * @param {number} offset - Character offset
 * @param {string} containerType - Type of container ('startContainer' or 'endContainer')
 * @returns {Object|null} Object with textNode and adjustedOffset, or null
 */
function findTextNodeInElement(element, offset, containerType) {
  try {
    if (!element || offset < 0) {
      return null;
    }

    // Create tree walker to find text nodes
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Only accept text nodes with actual content
          return node.textContent.trim().length > 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      },
      false
    );

    let currentOffset = 0;
    let textNode;

    // Walk through text nodes until we reach the target offset
    while (textNode = walker.nextNode()) {
      const nodeLength = textNode.textContent.length;

      if (currentOffset + nodeLength >= offset) {
        // Found the text node containing our offset
        const adjustedOffset = offset - currentOffset;
        return {
          textNode: textNode,
          adjustedOffset: adjustedOffset
        };
      }

      currentOffset += nodeLength;
    }

    // If offset is beyond all text, return the last text node
    if (containerType === 'endContainer' && textNode) {
      return {
        textNode: textNode,
        adjustedOffset: textNode.textContent.length
      };
    }

    return null;

  } catch (error) {
    console.error('[Web Notes] Error finding text node in element:', error);
    return null;
  }
}

/**
 * Generate optimal selector for an element (prefers CSS, falls back to XPath)
 * @param {Element} element - Element to generate selector for
 * @returns {Object} Object with css and xpath selectors
 */
function generateOptimalSelector(element) {
  try {
    if (!element) {
      return { css: null, xpath: null };
    }

    const css = generateCSSSelector(element);
    const xpath = generateXPath(element);

    // Validate that at least one selector works
    if (css && document.querySelector(css) === element) {
      return { css, xpath };
    }

    if (xpath && validateXPath(xpath)) {
      try {
        const result = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (result.singleNodeValue === element) {
          return { css: null, xpath };
        }
      } catch (xpathError) {
        console.warn('[Web Notes] Generated XPath validation failed:', xpath, xpathError);
      }
    }

    // If both fail, try a more robust CSS selector
    const robustCSS = generateRobustCSSSelector(element);
    if (robustCSS && document.querySelector(robustCSS) === element) {
      return { css: robustCSS, xpath };
    }

    console.warn('[Web Notes] Could not generate reliable selector for element:', element);
    return { css, xpath }; // Return what we have, even if not perfect

  } catch (error) {
    console.error('[Web Notes] Error generating optimal selector:', error);
    return { css: null, xpath: null };
  }
}

/**
 * Generate CSS selector for an element
 * @param {Element} element - Element to generate selector for
 * @returns {string|null} CSS selector string
 */
function generateCSSSelector(element) {
  try {
    if (!element || element === document.documentElement) {
      return null;
    }

    // Start with basic path
    const path = [];
    let current = element;

    while (current && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      // Add ID if available and unique
      if (current.id && isIdUnique(current.id)) {
        selector += `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break; // ID should be sufficient
      }

      // Add classes if available
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/)
          .filter(cls => cls && isValidCSSClass(cls))
          .map(cls => CSS.escape(cls))
          .slice(0, 3); // Limit to 3 classes for performance

        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      // Add nth-child if needed for uniqueness
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          el => el.tagName === current.tagName
        );

        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.length > 0 ? path.join(' > ') : null;

  } catch (error) {
    console.error('[Web Notes] Error generating CSS selector:', error);
    return null;
  }
}

/**
 * Generate a more robust CSS selector as fallback
 * @param {Element} element - Element to generate selector for
 * @returns {string|null} Robust CSS selector string
 */
function generateRobustCSSSelector(element) {
  try {
    if (!element) {
      return null;
    }

    // Use full path with tag names and positions
    const path = [];
    let current = element;

    while (current && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      // Always include nth-child for specificity
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.length > 0 ? path.join(' > ') : null;

  } catch (error) {
    console.error('[Web Notes] Error generating robust CSS selector:', error);
    return null;
  }
}

/**
 * Generate XPath for an element
 * @param {Element} element - Element to generate XPath for
 * @returns {string|null} XPath string
 */
function generateXPath(element) {
  try {
    if (!element) {
      return null;
    }

    const path = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
      let index = 1;
      let sibling = current.previousSibling;

      // Count preceding siblings with the same tag name
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = current.tagName.toLowerCase();
      const pathSegment = `${tagName}[${index}]`;
      path.unshift(pathSegment);

      current = current.parentElement;
    }

    return path.length > 0 ? `//${path.join('/')}` : null;

  } catch (error) {
    console.error('[Web Notes] Error generating XPath:', error);
    return null;
  }
}

/**
 * Check if an ID is unique in the document
 * @param {string} id - ID to check
 * @returns {boolean} True if ID is unique
 */
function isIdUnique(id) {
  try {
    if (!id || typeof id !== 'string') {
      return false;
    }

    const elements = document.querySelectorAll(`#${CSS.escape(id)}`);
    return elements.length === 1;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a CSS class name is valid and safe
 * @param {string} className - Class name to validate
 * @returns {boolean} True if class is valid
 */
function isValidCSSClass(className) {
  try {
    if (!className || typeof className !== 'string') {
      return false;
    }

    // Basic CSS class validation
    const validClassPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    return validClassPattern.test(className) && className.length <= 50;
  } catch (error) {
    return false;
  }
}

/**
 * Test if both selectors point to the same element
 * @param {Object} noteData - Note data with selector information
 * @param {string} cacheKey - Cache key for performance
 * @returns {Element|null} Element if found, null otherwise
 */
function tryBothSelectors(noteData, cacheKey) {
  try {
    let targetElement = null;

    // Check cache first
    if (cacheKey && elementCache.has(cacheKey)) {
      const cached = elementCache.get(cacheKey);
      if (cached && document.contains(cached)) {
        return cached;
      } else {
        elementCache.delete(cacheKey);
      }
    }

    // Try CSS selector first
    if (noteData.cssSelector) {
      try {
        targetElement = document.querySelector(noteData.cssSelector);
        if (targetElement && cacheKey) {
          cacheElement(cacheKey, targetElement);
        }
      } catch (cssError) {
        console.warn('[Web Notes] CSS selector failed, trying XPath:', cssError);
      }
    }

    // Fallback to XPath
    if (!targetElement && noteData.xpath && validateXPath(noteData.xpath)) {
      try {
        const result = document.evaluate(
          noteData.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        targetElement = result.singleNodeValue;
        if (targetElement && cacheKey) {
          cacheElement(cacheKey, targetElement);
        }
      } catch (xpathError) {
        console.warn('[Web Notes] XPath selector also failed:', xpathError);
      }
    }

    return targetElement;

  } catch (error) {
    console.error('[Web Notes] Error trying both selectors:', error);
    return null;
  }
}

/**
 * Clear the element cache
 */
function clearElementCache() {
  elementCache.clear();
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
  return {
    size: elementCache.size,
    limit: CACHE_SIZE_LIMIT
  };
}

// Export functions for use by other modules
window.DOMSelectors = {
  // Core functions
  findElementBySelector,
  generateOptimalSelector,
  findTextNodeInElement,
  tryBothSelectors,

  // Selector generation
  generateCSSSelector,
  generateXPath,
  generateRobustCSSSelector,

  // Validation functions
  isIdUnique,
  isValidCSSClass,

  // Utility functions
  debounce,
  clearElementCache,
  getCacheStats,

  // Cache access (for debugging)
  elementCache
};