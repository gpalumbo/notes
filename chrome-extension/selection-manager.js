/**
 * Selection Manager Module
 * Handles text selection capture, highlighting, and selection data management
 */

/* global EXTENSION_CONSTANTS, validateXPath, sanitizeColor */

// Selection management constants
const SELECTION_CONSTANTS = {
  MAX_HIGHLIGHTS: 1000,
  MAX_SELECTION_LENGTH: 50000,
  HIGHLIGHT_CLASS: 'web-notes-highlight',
  HIGHLIGHT_CONTAINER_CLASS: 'web-notes-highlight-container'
};

// Map to store highlighting elements by note ID
const noteHighlights = new Map();

/**
 * Validate and sanitize color values to prevent CSS injection
 * @param {string} color - Color value to validate
 * @returns {string} Safe color value or fallback
 */
function sanitizeColor(color) {
  if (!color || typeof color !== 'string') {
    return '#fff3cd'; // Default light yellow
  }

  // Allow hex colors (3 or 6 digits)
  const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  if (hexPattern.test(color)) {
    return color;
  }

  // Allow rgb() values with basic validation
  const rgbPattern = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
  const rgbMatch = color.match(rgbPattern);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    // Validate RGB values are within 0-255 range
    if (parseInt(r) <= 255 && parseInt(g) <= 255 && parseInt(b) <= 255) {
      return color;
    }
  }

  // Allow rgba() values with basic validation
  const rgbaPattern = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([01]?\.?\d*)\s*\)$/;
  const rgbaMatch = color.match(rgbaPattern);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    // Validate RGB values are within 0-255 range and alpha is 0-1
    if (parseInt(r) <= 255 && parseInt(g) <= 255 && parseInt(b) <= 255 && parseFloat(a) <= 1) {
      return color;
    }
  }

  // Allow named colors (basic set for security)
  const namedColors = [
    'transparent', 'white', 'black', 'red', 'green', 'blue', 'yellow', 'orange',
    'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'lime'
  ];
  if (namedColors.includes(color.toLowerCase())) {
    return color.toLowerCase();
  }

  console.warn(`[Web Notes] Invalid color value: ${color}, using fallback`);
  return '#fff3cd'; // Fallback to default
}

/**
 * Validate XPath expressions to prevent injection attacks
 * @param {string} xpath - XPath expression to validate
 * @returns {boolean} True if XPath is safe to use
 */
function validateXPath(xpath) {
  if (!xpath || typeof xpath !== 'string') {
    return false;
  }

  // Basic XPath validation - only allow safe patterns
  // This is a conservative approach that blocks potentially dangerous XPath
  const safeXPathPattern = /^\/\/?\*?[\w\[\]@='"\s\d\-_\.\/\(\)]*$/;

  // Check for dangerous XPath functions or patterns
  const dangerousPatterns = [
    /document\s*\(/,
    /eval\s*\(/,
    /script\s*\(/,
    /javascript:/i,
    /data:/i,
    /<script/i,
    /on\w+\s*=/i
  ];

  if (!safeXPathPattern.test(xpath)) {
    return false;
  }

  for (const pattern of dangerousPatterns) {
    if (pattern.test(xpath)) {
      return false;
    }
  }

  return true;
}

/**
 * Clean up highlights map to prevent memory leaks
 */
function cleanupHighlights() {
  if (noteHighlights.size > SELECTION_CONSTANTS.MAX_HIGHLIGHTS) {
    const entries = Array.from(noteHighlights.entries());
    const excessCount = noteHighlights.size - SELECTION_CONSTANTS.MAX_HIGHLIGHTS;

    // Remove oldest entries (first half of excess)
    for (let i = 0; i < excessCount; i++) {
      const [noteId] = entries[i];
      removeTextHighlight(noteId);
    }

    console.log(`[Web Notes] Cleaned up ${excessCount} old highlights`);
  }
}

/**
 * Capture comprehensive selection data including position and context
 * @param {Selection} selection - The browser selection object
 * @returns {Object|null} Selection data object or null if invalid
 */
function captureSelectionData(selection) {
  try {
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (!selectedText || selectedText.length > SELECTION_CONSTANTS.MAX_SELECTION_LENGTH) {
      console.warn('[Web Notes] Selection too long or empty, skipping capture');
      return null;
    }

    const startContainer = range.startContainer;
    const endContainer = range.endContainer;

    // Find the common ancestor element
    const commonAncestor = range.commonAncestorContainer;
    const targetElement = commonAncestor.nodeType === Node.ELEMENT_NODE
      ? commonAncestor
      : commonAncestor.parentElement;

    if (!targetElement) {
      console.warn('[Web Notes] Could not find target element for selection');
      return null;
    }

    // Get surrounding context for better matching
    const contextBefore = getTextContext(startContainer, range.startOffset, -50);
    const contextAfter = getTextContext(endContainer, range.endOffset, 50);

    return {
      text: selectedText,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      contextBefore: contextBefore,
      contextAfter: contextAfter,
      targetElement: targetElement,
      startContainer: startContainer,
      endContainer: endContainer,
      boundingRect: range.getBoundingClientRect(),
      timestamp: Date.now()
    };

  } catch (error) {
    console.error('[Web Notes] Error capturing selection data:', error);
    return null;
  }
}

/**
 * Get text context around a position for better text matching
 * @param {Node} node - The text node
 * @param {number} offset - The offset within the node
 * @param {number} length - Length of context (negative for before, positive for after)
 * @returns {string} Context text
 */
function getTextContext(node, offset, length) {
  try {
    if (node.nodeType !== Node.TEXT_NODE) {
      return '';
    }

    const text = node.textContent || '';
    if (length < 0) {
      // Context before
      const start = Math.max(0, offset + length);
      return text.substring(start, offset);
    } else {
      // Context after
      const end = Math.min(text.length, offset + length);
      return text.substring(offset, end);
    }
  } catch (error) {
    console.error('[Web Notes] Error getting text context:', error);
    return '';
  }
}

/**
 * Create text highlighting for a note's selected text
 * @param {Object} noteData - Note data containing selection information
 * @param {string} backgroundColor - Background color for the highlight
 * @returns {boolean} Success status
 */
function createTextHighlight(noteData, backgroundColor = '#fff3cd') {
  try {
    if (!noteData.selectionData || !noteData.selectionData.text) {
      return false;
    }

    // Remove existing highlight for this note
    removeTextHighlight(noteData.id);

    const selectionData = noteData.selectionData;
    const targetElement = selectionData.targetElement;

    if (!targetElement || !document.contains(targetElement)) {
      console.warn('[Web Notes] Target element not found in document');
      return false;
    }

    // Find the text within the target element
    const textNode = findTextInElement(targetElement, selectionData.text, selectionData.contextBefore, selectionData.contextAfter);

    if (!textNode) {
      console.warn('[Web Notes] Could not locate text for highlighting');
      return false;
    }

    // Create the highlight
    const highlight = createHighlightSpan(selectionData.text, backgroundColor);

    // Insert highlight into the document
    const range = document.createRange();
    const textOffset = findTextOffset(textNode.node, selectionData.text, selectionData.contextBefore);

    if (textOffset === -1) {
      console.warn('[Web Notes] Could not find text offset for highlighting');
      return false;
    }

    range.setStart(textNode.node, textOffset);
    range.setEnd(textNode.node, textOffset + selectionData.text.length);

    // Extract and replace with highlighted content
    const extractedContent = range.extractContents();
    range.insertNode(highlight);
    highlight.appendChild(extractedContent);

    // Store highlight reference
    noteHighlights.set(noteData.id, {
      element: highlight,
      targetElement: targetElement,
      originalText: selectionData.text
    });

    // Cleanup if we have too many highlights
    cleanupHighlights();

    return true;

  } catch (error) {
    console.error('[Web Notes] Error creating text highlight:', error);
    return false;
  }
}

/**
 * Find text within an element using context clues
 * @param {Element} element - Element to search within
 * @param {string} text - Text to find
 * @param {string} contextBefore - Context before the text
 * @param {string} contextAfter - Context after the text
 * @returns {Object|null} Object with node and position, or null if not found
 */
function findTextInElement(element, text, contextBefore = '', contextAfter = '') {
  try {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      const nodeText = node.textContent || '';

      // Try to find the text with context
      const fullContext = contextBefore + text + contextAfter;
      if (nodeText.includes(fullContext)) {
        return { node, position: nodeText.indexOf(fullContext) + contextBefore.length };
      }

      // Fallback: try to find just the text
      if (nodeText.includes(text)) {
        return { node, position: nodeText.indexOf(text) };
      }
    }

    return null;
  } catch (error) {
    console.error('[Web Notes] Error finding text in element:', error);
    return null;
  }
}

/**
 * Find the offset of text within a text node
 * @param {Node} textNode - Text node to search
 * @param {string} text - Text to find
 * @param {string} contextBefore - Context before the text
 * @returns {number} Offset or -1 if not found
 */
function findTextOffset(textNode, text, contextBefore = '') {
  try {
    const nodeText = textNode.textContent || '';

    // Try with context first
    if (contextBefore) {
      const contextIndex = nodeText.indexOf(contextBefore + text);
      if (contextIndex !== -1) {
        return contextIndex + contextBefore.length;
      }
    }

    // Fallback to just the text
    return nodeText.indexOf(text);
  } catch (error) {
    console.error('[Web Notes] Error finding text offset:', error);
    return -1;
  }
}

/**
 * Create a highlight span element
 * @param {string} text - Text to highlight
 * @param {string} backgroundColor - Background color
 * @returns {Element} Highlight span element
 */
function createHighlightSpan(text, backgroundColor) {
  const span = document.createElement('span');
  span.className = SELECTION_CONSTANTS.HIGHLIGHT_CLASS;
  span.style.cssText = `
    background-color: ${sanitizeColor(backgroundColor)} !important;
    padding: 1px 2px !important;
    border-radius: 2px !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
    position: relative !important;
    z-index: 1 !important;
  `;

  // Add a subtle border to make it more visible
  span.style.border = '1px solid rgba(0,0,0,0.1)';

  return span;
}

/**
 * Remove text highlighting for a specific note
 * @param {string} noteId - ID of the note
 * @returns {boolean} Success status
 */
function removeTextHighlight(noteId) {
  try {
    const highlightData = noteHighlights.get(noteId);
    if (!highlightData) {
      return false;
    }

    const { element } = highlightData;
    if (element && element.parentNode) {
      // Replace highlight with its text content
      const textContent = element.textContent;
      const textNode = document.createTextNode(textContent);
      element.parentNode.replaceChild(textNode, element);

      // Normalize the parent to merge adjacent text nodes
      if (textNode.parentNode) {
        textNode.parentNode.normalize();
      }
    }

    noteHighlights.delete(noteId);
    return true;

  } catch (error) {
    console.error('[Web Notes] Error removing text highlight:', error);
    return false;
  }
}

/**
 * Get all current highlights
 * @returns {Map} Map of note IDs to highlight data
 */
function getAllHighlights() {
  return new Map(noteHighlights);
}

/**
 * Clear all text highlights
 */
function clearAllHighlights() {
  try {
    for (const [noteId] of noteHighlights) {
      removeTextHighlight(noteId);
    }
    noteHighlights.clear();
  } catch (error) {
    console.error('[Web Notes] Error clearing all highlights:', error);
  }
}

/**
 * Check if a note has an active highlight
 * @param {string} noteId - ID of the note
 * @returns {boolean} True if note has highlight
 */
function hasHighlight(noteId) {
  return noteHighlights.has(noteId);
}

// Export functions for use by other modules
window.SelectionManager = {
  // Core functions
  captureSelectionData,
  createTextHighlight,
  removeTextHighlight,

  // Utility functions
  sanitizeColor,
  validateXPath,
  cleanupHighlights,

  // Query functions
  getAllHighlights,
  clearAllHighlights,
  hasHighlight,

  // Constants
  SELECTION_CONSTANTS
};