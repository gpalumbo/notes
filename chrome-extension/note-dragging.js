/**
 * Note Dragging Module
 * Handles drag and drop functionality for notes with smooth interactions
 */

/* global NotePositioning, NoteEditing, updateNote */

// Dragging state management
const DraggingState = {
  isDragging: false,
  draggedNote: null,
  draggedNoteData: null,
  targetElement: null,
  initialMousePos: { x: 0, y: 0 },
  initialNotePos: { x: 0, y: 0 },
  dragOffsetX: 0,
  dragOffsetY: 0
};

// Dragging constants
const DRAGGING_CONSTANTS = {
  DRAG_THRESHOLD: 5, // Minimum pixels to start drag
  DRAG_OPACITY: 0.8,
  DRAG_SCALE: 1.05,
  DRAG_Z_INDEX: 10001,
  SNAP_THRESHOLD: 20, // Pixels for snapping to elements
  SCROLL_ZONE_SIZE: 50, // Pixels from edge to trigger scroll
  SCROLL_SPEED: 5 // Scroll speed in pixels
};

/**
 * Make a note element draggable
 * @param {Element} noteElement - Note element to make draggable
 * @param {Object} noteData - Note data
 * @param {Element} targetElement - Target anchor element (optional)
 */
function makeDraggable(noteElement, noteData, targetElement = null) {
  try {
    if (!noteElement || !noteData) return;

    // Remove existing drag listeners
    removeDragListeners(noteElement);

    // Mouse down handler
    const handleMouseDown = (event) => {
      // Don't start dragging if user is editing or clicked on interactive elements
      if (NoteEditing.isNoteBeingEdited(noteElement)) {
        return;
      }

      if (event.target.tagName === 'BUTTON' ||
          event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA' ||
          event.target.closest('.markdown-toolbar')) {
        return;
      }

      event.preventDefault();
      startDrag(event, noteElement, noteData, targetElement);
    };

    // Add mouse down listener
    noteElement.addEventListener('mousedown', handleMouseDown);

    // Store listener for cleanup
    noteElement._dragListeners = {
      mousedown: handleMouseDown
    };

    // Update cursor style
    NotePositioning.updateNoteCursor(noteElement);

  } catch (error) {
    console.error('[Web Notes] Error making note draggable:', error);
  }
}

/**
 * Remove drag listeners from note element
 * @param {Element} noteElement - Note element
 */
function removeDragListeners(noteElement) {
  try {
    if (noteElement._dragListeners) {
      noteElement.removeEventListener('mousedown', noteElement._dragListeners.mousedown);
      delete noteElement._dragListeners;
    }
  } catch (error) {
    console.error('[Web Notes] Error removing drag listeners:', error);
  }
}

/**
 * Start dragging operation
 * @param {MouseEvent} event - Mouse down event
 * @param {Element} noteElement - Note element
 * @param {Object} noteData - Note data
 * @param {Element} targetElement - Target anchor element
 */
function startDrag(event, noteElement, noteData, targetElement) {
  try {
    // Store initial state
    DraggingState.isDragging = false; // Will be set to true when threshold is exceeded
    DraggingState.draggedNote = noteElement;
    DraggingState.draggedNoteData = noteData;
    DraggingState.targetElement = targetElement;

    DraggingState.initialMousePos = {
      x: event.clientX,
      y: event.clientY
    };

    const noteRect = noteElement.getBoundingClientRect();
    DraggingState.initialNotePos = {
      x: noteRect.left + window.pageXOffset,
      y: noteRect.top + window.pageYOffset
    };

    // Calculate offset from mouse to note top-left
    DraggingState.dragOffsetX = event.clientX - noteRect.left;
    DraggingState.dragOffsetY = event.clientY - noteRect.top;

    // Add global event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';

  } catch (error) {
    console.error('[Web Notes] Error starting drag:', error);
  }
}

/**
 * Handle mouse move during drag
 * @param {MouseEvent} event - Mouse move event
 */
function handleMouseMove(event) {
  try {
    const { draggedNote, initialMousePos, initialNotePos } = DraggingState;

    if (!draggedNote) return;

    const deltaX = event.clientX - initialMousePos.x;
    const deltaY = event.clientY - initialMousePos.y;

    // Check if we've moved enough to start dragging
    if (!DraggingState.isDragging) {
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (distance > DRAGGING_CONSTANTS.DRAG_THRESHOLD) {
        DraggingState.isDragging = true;
        startDragVisualEffects(draggedNote);
      } else {
        return; // Not enough movement yet
      }
    }

    // Calculate new position
    const newX = initialNotePos.x + deltaX;
    const newY = initialNotePos.y + deltaY;

    // Update note position
    draggedNote.style.left = `${newX}px`;
    draggedNote.style.top = `${newY}px`;

    // Handle auto-scrolling if near viewport edges
    handleAutoScroll(event);

    // Show visual feedback for potential drop targets
    updateDropTargetHighlight(event);

  } catch (error) {
    console.error('[Web Notes] Error handling mouse move:', error);
  }
}

/**
 * Handle mouse up to end drag
 * @param {MouseEvent} event - Mouse up event
 */
function handleMouseUp(event) {
  try {
    // Remove global listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    // Restore text selection
    document.body.style.userSelect = '';

    if (DraggingState.isDragging) {
      finishDrag(event);
    }

    // Clear dragging state
    clearDraggingState();

  } catch (error) {
    console.error('[Web Notes] Error handling mouse up:', error);
  }
}

/**
 * Start visual effects for dragging
 * @param {Element} noteElement - Note element being dragged
 */
function startDragVisualEffects(noteElement) {
  try {
    if (!noteElement) return;

    // Apply dragging styles
    noteElement.style.opacity = DRAGGING_CONSTANTS.DRAG_OPACITY;
    noteElement.style.transform = `scale(${DRAGGING_CONSTANTS.DRAG_SCALE})`;
    noteElement.style.zIndex = DRAGGING_CONSTANTS.DRAG_Z_INDEX;
    noteElement.style.cursor = 'grabbing';
    noteElement.style.boxShadow = '0 8px 25px rgba(0,0,0,0.25)';

    // Add dragging class
    noteElement.classList.add('note-dragging');

  } catch (error) {
    console.error('[Web Notes] Error starting drag visual effects:', error);
  }
}

/**
 * Finish dragging operation
 * @param {MouseEvent} event - Mouse up event
 */
function finishDrag(event) {
  try {
    const { draggedNote, draggedNoteData, targetElement } = DraggingState;

    if (!draggedNote || !draggedNoteData) return;

    // Remove dragging visual effects
    endDragVisualEffects(draggedNote);

    // Calculate final position
    const finalRect = draggedNote.getBoundingClientRect();
    const finalX = finalRect.left + window.pageXOffset;
    const finalY = finalRect.top + window.pageYOffset;

    // Find new anchor element if note was moved significantly
    const newAnchor = findNearestAnchorElement(event, draggedNote);

    if (newAnchor && newAnchor !== targetElement) {
      // Note is being anchored to a new element
      anchorNoteToElement(draggedNote, draggedNoteData, newAnchor);
    } else if (targetElement) {
      // Update offset for existing anchor
      updateAnchoredNoteOffset(draggedNote, draggedNoteData, targetElement, finalX, finalY);
    } else {
      // Free-floating note - just update absolute position
      updateFreeFloatingNote(draggedNoteData, finalX, finalY);
    }

    // Ensure note remains visible
    setTimeout(() => {
      NotePositioning.ensureNoteVisibility(draggedNote, draggedNoteData);
    }, 50);

    console.log(`[Web Notes] Finished dragging note: ${draggedNoteData.id}`);

  } catch (error) {
    console.error('[Web Notes] Error finishing drag:', error);
  }
}

/**
 * End visual effects for dragging
 * @param {Element} noteElement - Note element
 */
function endDragVisualEffects(noteElement) {
  try {
    if (!noteElement) return;

    // Reset dragging styles
    noteElement.style.opacity = '';
    noteElement.style.transform = '';
    noteElement.style.zIndex = '10000';
    noteElement.style.cursor = '';
    noteElement.style.boxShadow = '';

    // Remove dragging class
    noteElement.classList.remove('note-dragging');

    // Restore normal interactive effects
    const isAnchored = !!(noteElement.dataset.cssSelector || noteElement.dataset.xpath);
    NotePositioning.addInteractiveEffects(noteElement, isAnchored);

  } catch (error) {
    console.error('[Web Notes] Error ending drag visual effects:', error);
  }
}

/**
 * Handle auto-scrolling when dragging near viewport edges
 * @param {MouseEvent} event - Mouse event
 */
function handleAutoScroll(event) {
  try {
    const { clientX, clientY } = event;
    const { innerWidth, innerHeight } = window;
    const { SCROLL_ZONE_SIZE, SCROLL_SPEED } = DRAGGING_CONSTANTS;

    let scrollX = 0;
    let scrollY = 0;

    // Check horizontal scrolling
    if (clientX < SCROLL_ZONE_SIZE) {
      scrollX = -SCROLL_SPEED;
    } else if (clientX > innerWidth - SCROLL_ZONE_SIZE) {
      scrollX = SCROLL_SPEED;
    }

    // Check vertical scrolling
    if (clientY < SCROLL_ZONE_SIZE) {
      scrollY = -SCROLL_SPEED;
    } else if (clientY > innerHeight - SCROLL_ZONE_SIZE) {
      scrollY = SCROLL_SPEED;
    }

    // Perform scrolling
    if (scrollX !== 0 || scrollY !== 0) {
      window.scrollBy(scrollX, scrollY);

      // Update note position to account for scrolling
      if (DraggingState.draggedNote) {
        const currentLeft = parseInt(DraggingState.draggedNote.style.left);
        const currentTop = parseInt(DraggingState.draggedNote.style.top);
        DraggingState.draggedNote.style.left = `${currentLeft + scrollX}px`;
        DraggingState.draggedNote.style.top = `${currentTop + scrollY}px`;
      }
    }

  } catch (error) {
    console.error('[Web Notes] Error handling auto scroll:', error);
  }
}

/**
 * Update drop target highlighting
 * @param {MouseEvent} event - Mouse event
 */
function updateDropTargetHighlight(event) {
  try {
    // Remove existing highlights
    document.querySelectorAll('.note-drop-target').forEach(el => {
      el.classList.remove('note-drop-target');
    });

    // Find element under cursor (excluding the dragged note)
    const elementUnderCursor = getElementUnderCursor(event);

    if (elementUnderCursor && canAnchorToElement(elementUnderCursor)) {
      elementUnderCursor.classList.add('note-drop-target');
    }

  } catch (error) {
    console.error('[Web Notes] Error updating drop target highlight:', error);
  }
}

/**
 * Get element under cursor, excluding dragged note
 * @param {MouseEvent} event - Mouse event
 * @returns {Element|null} Element under cursor
 */
function getElementUnderCursor(event) {
  try {
    const { draggedNote } = DraggingState;

    if (draggedNote) {
      // Temporarily hide dragged note
      const originalDisplay = draggedNote.style.display;
      draggedNote.style.display = 'none';

      const element = document.elementFromPoint(event.clientX, event.clientY);

      // Restore dragged note
      draggedNote.style.display = originalDisplay;

      return element;
    }

    return document.elementFromPoint(event.clientX, event.clientY);

  } catch (error) {
    console.error('[Web Notes] Error getting element under cursor:', error);
    return null;
  }
}

/**
 * Check if note can be anchored to element
 * @param {Element} element - Element to check
 * @returns {boolean} True if element is suitable for anchoring
 */
function canAnchorToElement(element) {
  try {
    if (!element) return false;

    // Don't anchor to other notes or extension elements
    if (element.classList.contains('web-notes-note') ||
        element.closest('.web-notes-note') ||
        element.classList.contains('web-notes-highlight') ||
        element.closest('.web-notes-highlight')) {
      return false;
    }

    // Don't anchor to very small or invisible elements
    const rect = element.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      return false;
    }

    // Prefer semantic elements
    const preferredTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'SECTION', 'ARTICLE'];
    return preferredTags.includes(element.tagName);

  } catch (error) {
    console.error('[Web Notes] Error checking anchor suitability:', error);
    return false;
  }
}

/**
 * Find nearest suitable anchor element
 * @param {MouseEvent} event - Mouse event
 * @param {Element} draggedNote - Dragged note element
 * @returns {Element|null} Nearest anchor element
 */
function findNearestAnchorElement(event, draggedNote) {
  try {
    const elementUnderCursor = getElementUnderCursor(event);

    if (canAnchorToElement(elementUnderCursor)) {
      return elementUnderCursor;
    }

    // Look for nearby suitable elements
    const rect = elementUnderCursor?.getBoundingClientRect();
    if (rect) {
      const elements = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      for (const element of elements) {
        if (canAnchorToElement(element)) {
          return element;
        }
      }
    }

    return null;

  } catch (error) {
    console.error('[Web Notes] Error finding nearest anchor element:', error);
    return null;
  }
}

/**
 * Anchor note to a new element
 * @param {Element} noteElement - Note element
 * @param {Object} noteData - Note data
 * @param {Element} anchorElement - Element to anchor to
 */
async function anchorNoteToElement(noteElement, noteData, anchorElement) {
  try {
    // Generate selectors for the new anchor element
    const selectors = window.DOMSelectors.generateOptimalSelector(anchorElement);

    if (!selectors.css && !selectors.xpath) {
      console.warn('[Web Notes] Could not generate selectors for anchor element');
      return;
    }

    // Calculate offset relative to new anchor
    const noteRect = noteElement.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();

    const offsetX = (noteRect.left + window.pageXOffset) - (anchorRect.left + window.pageXOffset);
    const offsetY = (noteRect.top + window.pageYOffset) - (anchorRect.top + window.pageYOffset);

    // Update note data
    const updatedData = {
      cssSelector: selectors.css,
      xpath: selectors.xpath,
      offsetX: offsetX,
      offsetY: offsetY
    };

    // Save to storage
    const currentUrl = window.location.href;
    const success = await updateNote(currentUrl, noteData.id, updatedData);

    if (success) {
      // Update DOM element data attributes
      noteElement.dataset.cssSelector = selectors.css || '';
      noteElement.dataset.xpath = selectors.xpath || '';

      // Update visual effects
      NotePositioning.addInteractiveEffects(noteElement, true);

      console.log(`[Web Notes] Anchored note ${noteData.id} to new element`);
    } else {
      console.error(`[Web Notes] Failed to save anchor data for note ${noteData.id}`);
    }

  } catch (error) {
    console.error('[Web Notes] Error anchoring note to element:', error);
  }
}

/**
 * Update offset for anchored note
 * @param {Element} noteElement - Note element
 * @param {Object} noteData - Note data
 * @param {Element} targetElement - Target anchor element
 * @param {number} finalX - Final X position
 * @param {number} finalY - Final Y position
 */
async function updateAnchoredNoteOffset(noteElement, noteData, targetElement, finalX, finalY) {
  try {
    const targetRect = targetElement.getBoundingClientRect();
    const newOffsetX = finalX - (targetRect.left + window.pageXOffset);
    const newOffsetY = finalY - (targetRect.top + window.pageYOffset);

    // Update note offset
    await NotePositioning.updateNoteOffset(noteData.id, newOffsetX, newOffsetY);

    console.log(`[Web Notes] Updated anchored note offset: ${noteData.id}`);

  } catch (error) {
    console.error('[Web Notes] Error updating anchored note offset:', error);
  }
}

/**
 * Update free-floating note position
 * @param {Object} noteData - Note data
 * @param {number} finalX - Final X position
 * @param {number} finalY - Final Y position
 */
async function updateFreeFloatingNote(noteData, finalX, finalY) {
  try {
    const updatedData = {
      x: finalX,
      y: finalY,
      // Clear anchor data if it exists
      cssSelector: null,
      xpath: null,
      offsetX: null,
      offsetY: null
    };

    const currentUrl = window.location.href;
    const success = await updateNote(currentUrl, noteData.id, updatedData);

    if (success) {
      console.log(`[Web Notes] Updated free-floating note position: ${noteData.id}`);
    } else {
      console.error(`[Web Notes] Failed to update note position: ${noteData.id}`);
    }

  } catch (error) {
    console.error('[Web Notes] Error updating free-floating note:', error);
  }
}

/**
 * Clear dragging state
 */
function clearDraggingState() {
  try {
    // Remove drop target highlights
    document.querySelectorAll('.note-drop-target').forEach(el => {
      el.classList.remove('note-drop-target');
    });

    // Reset state
    DraggingState.isDragging = false;
    DraggingState.draggedNote = null;
    DraggingState.draggedNoteData = null;
    DraggingState.targetElement = null;
    DraggingState.initialMousePos = { x: 0, y: 0 };
    DraggingState.initialNotePos = { x: 0, y: 0 };
    DraggingState.dragOffsetX = 0;
    DraggingState.dragOffsetY = 0;

  } catch (error) {
    console.error('[Web Notes] Error clearing dragging state:', error);
  }
}

/**
 * Check if currently dragging
 * @returns {boolean} True if currently dragging
 */
function isDragging() {
  return DraggingState.isDragging;
}

/**
 * Get currently dragged note
 * @returns {Element|null} Currently dragged note element
 */
function getDraggedNote() {
  return DraggingState.draggedNote;
}

// Export functions for use by other modules
window.NoteDragging = {
  // Core dragging functions
  makeDraggable,
  removeDragListeners,

  // State queries
  isDragging,
  getDraggedNote,

  // Utility functions
  canAnchorToElement,
  findNearestAnchorElement,

  // Constants and state
  DRAGGING_CONSTANTS,
  DraggingState
};