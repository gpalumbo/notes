/**
 * Note Positioning Module
 * Handles note positioning, anchoring, visibility management, and repositioning
 */

/* global DOMSelectors, TIMING */

// Positioning constants
const POSITIONING_CONSTANTS = {
  DEFAULT_OFFSET_X: 10,
  DEFAULT_OFFSET_Y: 10,
  MIN_VIEWPORT_MARGIN: 20,
  MAX_REPOSITIONING_ATTEMPTS: 3,
  VISIBILITY_CHECK_DELAY: 100,
  RESIZE_THROTTLE_DELAY: 300
};

/**
 * Ensure note visibility within viewport with intelligent repositioning
 * @param {Element} noteElement - The note element
 * @param {Object} noteData - Note data with positioning information
 */
function ensureNoteVisibility(noteElement, noteData) {
  try {
    if (!noteElement || !document.contains(noteElement)) {
      return;
    }

    const rect = noteElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let adjusted = false;
    let newLeft = noteElement.offsetLeft;
    let newTop = noteElement.offsetTop;

    // Check horizontal overflow
    if (rect.right > viewport.width - POSITIONING_CONSTANTS.MIN_VIEWPORT_MARGIN) {
      newLeft = viewport.width - rect.width - POSITIONING_CONSTANTS.MIN_VIEWPORT_MARGIN + window.pageXOffset;
      adjusted = true;
    } else if (rect.left < POSITIONING_CONSTANTS.MIN_VIEWPORT_MARGIN) {
      newLeft = POSITIONING_CONSTANTS.MIN_VIEWPORT_MARGIN + window.pageXOffset;
      adjusted = true;
    }

    // Check vertical overflow
    if (rect.bottom > viewport.height - POSITIONING_CONSTANTS.MIN_VIEWPORT_MARGIN) {
      newTop = viewport.height - rect.height - POSITIONING_CONSTANTS.MIN_VIEWPORT_MARGIN + window.pageYOffset;
      adjusted = true;
    } else if (rect.top < POSITIONING_CONSTANTS.MIN_VIEWPORT_MARGIN) {
      newTop = POSITIONING_CONSTANTS.MIN_VIEWPORT_MARGIN + window.pageYOffset;
      adjusted = true;
    }

    // Apply adjustments if needed
    if (adjusted) {
      noteElement.style.left = `${newLeft}px`;
      noteElement.style.top = `${newTop}px`;

      // Update stored offsets if note is anchored
      if (noteData.cssSelector || noteData.xpath) {
        const targetElement = DOMSelectors.findElementBySelector({
          css: noteData.cssSelector,
          xpath: noteData.xpath
        });

        if (targetElement) {
          const targetRect = targetElement.getBoundingClientRect();
          const newOffsetX = newLeft - (targetRect.left + window.pageXOffset);
          const newOffsetY = newTop - (targetRect.top + window.pageYOffset);

          // Update note data with new offsets
          updateNoteOffset(noteData.id, newOffsetX, newOffsetY);
        }
      }

      console.log(`[Web Notes] Adjusted note position for visibility: ${noteData.id}`);
    }

  } catch (error) {
    console.error('[Web Notes] Error ensuring note visibility:', error);
  }
}

/**
 * Reposition all notes when page layout changes
 */
function repositionAllNotes() {
  try {
    const notes = document.querySelectorAll('.web-notes-note');

    notes.forEach(noteElement => {
      try {
        const noteId = noteElement.dataset.noteId;
        if (!noteId) return;

        const noteData = getNoteDataById(noteId);
        if (!noteData) return;

        // Reposition anchored notes
        if (noteData.cssSelector || noteData.xpath) {
          const targetElement = DOMSelectors.findElementBySelector({
            css: noteData.cssSelector,
            xpath: noteData.xpath
          });

          if (targetElement) {
            const newPosition = calculateNotePosition(noteData, targetElement);
            if (newPosition) {
              noteElement.style.left = `${newPosition.x}px`;
              noteElement.style.top = `${newPosition.y}px`;
            }
          } else {
            console.warn(`[Web Notes] Could not find anchor element for note: ${noteId}`);
          }
        }

        // Ensure note remains visible
        setTimeout(() => {
          ensureNoteVisibility(noteElement, noteData);
        }, POSITIONING_CONSTANTS.VISIBILITY_CHECK_DELAY);

      } catch (error) {
        console.error('[Web Notes] Error repositioning individual note:', error);
      }
    });

  } catch (error) {
    console.error('[Web Notes] Error repositioning all notes:', error);
  }
}

/**
 * Handle window resize with throttling
 */
const handleWindowResize = DOMSelectors.debounce(() => {
  repositionAllNotes();
}, POSITIONING_CONSTANTS.RESIZE_THROTTLE_DELAY);

/**
 * Ensure all notes are visible with batched operations for performance
 * @param {NodeList} allNotes - All note elements
 * @param {Array} urlNotes - Note data array
 */
function ensureAllNotesVisibleBatched(allNotes, urlNotes) {
  try {
    if (!allNotes || allNotes.length === 0) return;

    // Use requestAnimationFrame for smooth repositioning
    requestAnimationFrame(() => {
      const noteDataMap = new Map(urlNotes.map(note => [note.id, note]));

      allNotes.forEach(noteElement => {
        try {
          const noteId = noteElement.dataset.noteId;
          const noteData = noteDataMap.get(noteId);

          if (noteData) {
            ensureNoteVisibility(noteElement, noteData);
          }
        } catch (error) {
          console.error('[Web Notes] Error in batched visibility check:', error);
        }
      });
    });

  } catch (error) {
    console.error('[Web Notes] Error in ensureAllNotesVisibleBatched:', error);
  }
}

/**
 * Calculate optimal note position relative to target element
 * @param {Object} noteData - Note data with positioning information
 * @param {Element} targetElement - Target anchor element
 * @returns {Object|null} Position object with x, y coordinates
 */
function calculateNotePosition(noteData, targetElement) {
  try {
    if (!targetElement || !document.contains(targetElement)) {
      return null;
    }

    const targetRect = targetElement.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Use stored offsets or defaults
    const offsetX = noteData.offsetX ?? POSITIONING_CONSTANTS.DEFAULT_OFFSET_X;
    const offsetY = noteData.offsetY ?? POSITIONING_CONSTANTS.DEFAULT_OFFSET_Y;

    const x = targetRect.left + scrollLeft + offsetX;
    const y = targetRect.top + scrollTop + offsetY;

    return { x, y };

  } catch (error) {
    console.error('[Web Notes] Error calculating note position:', error);
    return null;
  }
}

/**
 * Update note offset in storage and UI
 * @param {string} noteId - Note ID
 * @param {number} newOffsetX - New X offset
 * @param {number} newOffsetY - New Y offset
 */
async function updateNoteOffset(noteId, newOffsetX, newOffsetY) {
  try {
    const currentUrl = window.location.href;

    // Update in storage
    const success = await updateNote(currentUrl, noteId, {
      offsetX: newOffsetX,
      offsetY: newOffsetY
    });

    if (success) {
      console.log(`[Web Notes] Updated note offset: ${noteId} (${newOffsetX}, ${newOffsetY})`);
    } else {
      console.warn(`[Web Notes] Failed to update note offset: ${noteId}`);
    }

  } catch (error) {
    console.error('[Web Notes] Error updating note offset:', error);
  }
}

/**
 * Update note cursor style based on anchoring state
 * @param {Element} noteElement - Note element
 */
function updateNoteCursor(noteElement) {
  try {
    if (!noteElement) return;

    const noteId = noteElement.dataset.noteId;
    const noteData = getNoteDataById(noteId);

    if (noteData && (noteData.cssSelector || noteData.xpath)) {
      // Anchored note - show move cursor
      noteElement.style.cursor = 'move';
      noteElement.title = 'Drag to reposition (anchored to element)';
    } else {
      // Free-floating note - show grab cursor
      noteElement.style.cursor = 'grab';
      noteElement.title = 'Drag to move';
    }

  } catch (error) {
    console.error('[Web Notes] Error updating note cursor:', error);
  }
}

/**
 * Add interactive visual effects for better UX
 * @param {Element} noteElement - Note element
 * @param {boolean} isAnchored - Whether note is anchored to an element
 */
function addInteractiveEffects(noteElement, isAnchored) {
  try {
    if (!noteElement) return;

    // Remove existing effect classes
    noteElement.classList.remove('note-anchored', 'note-floating');

    // Add appropriate class
    if (isAnchored) {
      noteElement.classList.add('note-anchored');
    } else {
      noteElement.classList.add('note-floating');
    }

    // Add hover effects
    const addHoverEffects = () => {
      noteElement.style.transform = 'scale(1.02)';
      noteElement.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
      noteElement.style.zIndex = '10001';
    };

    const removeHoverEffects = () => {
      noteElement.style.transform = 'scale(1)';
      noteElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      noteElement.style.zIndex = '10000';
    };

    // Clean up existing listeners
    noteElement.removeEventListener('mouseenter', addHoverEffects);
    noteElement.removeEventListener('mouseleave', removeHoverEffects);

    // Add new listeners
    noteElement.addEventListener('mouseenter', addHoverEffects);
    noteElement.addEventListener('mouseleave', removeHoverEffects);

    // Update cursor
    updateNoteCursor(noteElement);

  } catch (error) {
    console.error('[Web Notes] Error adding interactive effects:', error);
  }
}

/**
 * Position note at specific coordinates (for new notes)
 * @param {Element} noteElement - Note element to position
 * @param {Object} coords - Coordinates object {x, y}
 * @param {Object} noteData - Note data for context
 */
function positionNoteAtCoords(noteElement, coords, noteData) {
  try {
    if (!noteElement || !coords) {
      return;
    }

    const x = coords.x || coords.pageX || 0;
    const y = coords.y || coords.pageY || 0;

    noteElement.style.position = 'absolute';
    noteElement.style.left = `${x}px`;
    noteElement.style.top = `${y}px`;
    noteElement.style.zIndex = '10000';

    // Ensure note is visible after positioning
    setTimeout(() => {
      ensureNoteVisibility(noteElement, noteData);
    }, POSITIONING_CONSTANTS.VISIBILITY_CHECK_DELAY);

  } catch (error) {
    console.error('[Web Notes] Error positioning note at coordinates:', error);
  }
}

/**
 * Check if element is in viewport
 * @param {Element} element - Element to check
 * @returns {boolean} True if element is visible in viewport
 */
function isElementInViewport(element) {
  try {
    if (!element || !document.contains(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= viewport.height &&
      rect.right <= viewport.width
    );

  } catch (error) {
    console.error('[Web Notes] Error checking viewport visibility:', error);
    return false;
  }
}

/**
 * Get note data by ID from current page notes
 * @param {string} noteId - Note ID to find
 * @returns {Object|null} Note data or null if not found
 */
function getNoteDataById(noteId) {
  try {
    // This will be populated by the main coordinator
    if (window.currentPageNotes && Array.isArray(window.currentPageNotes)) {
      return window.currentPageNotes.find(note => note.id === noteId) || null;
    }
    return null;
  } catch (error) {
    console.error('[Web Notes] Error getting note data by ID:', error);
    return null;
  }
}

/**
 * Animate note to new position
 * @param {Element} noteElement - Note element
 * @param {Object} newPosition - New position {x, y}
 * @param {number} duration - Animation duration in ms
 */
function animateNoteToPosition(noteElement, newPosition, duration = 300) {
  try {
    if (!noteElement || !newPosition) {
      return;
    }

    const startPosition = {
      x: parseInt(noteElement.style.left) || 0,
      y: parseInt(noteElement.style.top) || 0
    };

    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentX = startPosition.x + (newPosition.x - startPosition.x) * easeOut;
      const currentY = startPosition.y + (newPosition.y - startPosition.y) * easeOut;

      noteElement.style.left = `${currentX}px`;
      noteElement.style.top = `${currentY}px`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);

  } catch (error) {
    console.error('[Web Notes] Error animating note position:', error);
  }
}

// Initialize resize handler
if (typeof window !== 'undefined') {
  window.addEventListener('resize', handleWindowResize);
}

// Export functions for use by other modules
window.NotePositioning = {
  // Core positioning functions
  ensureNoteVisibility,
  repositionAllNotes,
  calculateNotePosition,
  positionNoteAtCoords,
  animateNoteToPosition,

  // Offset management
  updateNoteOffset,

  // Visual effects
  updateNoteCursor,
  addInteractiveEffects,

  // Batch operations
  ensureAllNotesVisibleBatched,

  // Utility functions
  isElementInViewport,
  getNoteDataById,

  // Event handlers
  handleWindowResize,

  // Constants
  POSITIONING_CONSTANTS
};