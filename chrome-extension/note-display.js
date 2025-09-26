/**
 * Note Display Module
 * Handles note creation, display, lifecycle management, and cleanup
 */

/* global getNotes, getNotesForUrl, addNote, deleteNote, normalizeUrlForNoteStorage */
/* global DOMSelectors, NotePositioning, NoteEditing, NoteDragging, SelectionManager */
/* global MarkdownUtils, handleColorSelection */

// Display state management
const DisplayState = {
  displayedNotes: new Map(), // noteId -> noteElement
  isDisplaying: false,
  currentPageNotes: [],
  loadingNotes: false
};

// Display constants
const DISPLAY_CONSTANTS = {
  FADE_ANIMATION_DELAY: 250,
  NOTE_CLEANUP_DELAY: 100,
  MAX_DISPLAYED_NOTES: 100,
  MIN_NOTE_WIDTH: 150,
  MAX_NOTE_WIDTH: 400,
  MIN_NOTE_HEIGHT: 50,
  DEFAULT_NOTE_WIDTH: 200
};

/**
 * Display a single note on the page
 * @param {Object} noteData - Note data object
 * @returns {Element|null} Created note element or null if failed
 */
function displayNote(noteData) {
  try {
    if (!noteData || !noteData.id) {
      console.warn('[Web Notes] Invalid note data provided to displayNote');
      return null;
    }

    // Check if note is already displayed
    if (DisplayState.displayedNotes.has(noteData.id)) {
      console.log(`[Web Notes] Note ${noteData.id} already displayed, skipping`);
      return DisplayState.displayedNotes.get(noteData.id);
    }

    // Create note element
    const noteElement = createNoteElement(noteData);
    if (!noteElement) {
      console.error(`[Web Notes] Failed to create note element for ${noteData.id}`);
      return null;
    }

    // Position the note
    const positioned = positionNote(noteElement, noteData);
    if (!positioned) {
      console.warn(`[Web Notes] Could not position note ${noteData.id}, displaying at default position`);
      // Still display the note even if positioning failed
      NotePositioning.positionNoteAtCoords(noteElement, { x: 50, y: 50 }, noteData);
    }

    // Add to DOM
    document.body.appendChild(noteElement);

    // Add to display tracking
    DisplayState.displayedNotes.set(noteData.id, noteElement);

    // Add interactive capabilities
    addNoteCapabilities(noteElement, noteData);

    // Create text highlight if applicable
    if (noteData.selectionData) {
      SelectionManager.createTextHighlight(noteData, noteData.backgroundColor || '#fff3cd');
    }

    // Fade in animation
    setTimeout(() => {
      noteElement.style.opacity = '1';
    }, 50);

    console.log(`[Web Notes] Displayed note: ${noteData.id}`);
    return noteElement;

  } catch (error) {
    console.error('[Web Notes] Error displaying note:', error);
    return null;
  }
}

/**
 * Create note element with proper styling and structure
 * @param {Object} noteData - Note data object
 * @returns {Element|null} Created note element
 */
function createNoteElement(noteData) {
  try {
    const noteElement = document.createElement('div');
    noteElement.className = 'web-notes-note';
    noteElement.dataset.noteId = noteData.id;

    // Store selector data in dataset
    if (noteData.cssSelector) {
      noteElement.dataset.cssSelector = noteData.cssSelector;
    }
    if (noteData.xpath) {
      noteElement.dataset.xpath = noteData.xpath;
    }

    // Apply base styling
    applyNoteBaseStyles(noteElement, noteData);

    // Create note structure
    const header = createNoteHeader(noteData);
    const content = createNoteContent(noteData);

    noteElement.appendChild(header);
    noteElement.appendChild(content);

    return noteElement;

  } catch (error) {
    console.error('[Web Notes] Error creating note element:', error);
    return null;
  }
}

/**
 * Apply base styles to note element
 * @param {Element} noteElement - Note element
 * @param {Object} noteData - Note data
 */
function applyNoteBaseStyles(noteElement, noteData) {
  try {
    const backgroundColor = SelectionManager.sanitizeColor(noteData.backgroundColor || '#fff3cd');
    const width = Math.max(DISPLAY_CONSTANTS.MIN_NOTE_WIDTH,
                          Math.min(noteData.width || DISPLAY_CONSTANTS.DEFAULT_NOTE_WIDTH,
                                   DISPLAY_CONSTANTS.MAX_NOTE_WIDTH));

    noteElement.style.cssText = `
      position: absolute !important;
      background-color: ${backgroundColor} !important;
      border: 1px solid rgba(0,0,0,0.2) !important;
      border-radius: 8px !important;
      padding: 12px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      line-height: 1.4 !important;
      color: #333 !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
      z-index: 10000 !important;
      max-width: ${DISPLAY_CONSTANTS.MAX_NOTE_WIDTH}px !important;
      min-width: ${DISPLAY_CONSTANTS.MIN_NOTE_WIDTH}px !important;
      width: ${width}px !important;
      box-sizing: border-box !important;
      opacity: 0 !important;
      transition: opacity ${DISPLAY_CONSTANTS.FADE_ANIMATION_DELAY}ms ease !important;
      word-wrap: break-word !important;
      resize: both !important;
      overflow: auto !important;
      cursor: move !important;
    `;

  } catch (error) {
    console.error('[Web Notes] Error applying note base styles:', error);
  }
}

/**
 * Create note header with controls
 * @param {Object} noteData - Note data
 * @returns {Element} Header element
 */
function createNoteHeader(noteData) {
  try {
    const header = document.createElement('div');
    header.className = 'note-header';

    header.style.cssText = `
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      margin-bottom: 8px !important;
      padding-bottom: 4px !important;
      border-bottom: 1px solid rgba(0,0,0,0.1) !important;
    `;

    // Note number/ID
    const noteNumber = document.createElement('span');
    noteNumber.className = 'note-number';
    noteNumber.textContent = `#${noteData.noteNumber || extractNoteNumber(noteData.id)}`;
    noteNumber.style.cssText = `
      font-size: 12px !important;
      font-weight: bold !important;
      color: rgba(0,0,0,0.6) !important;
      margin-right: 8px !important;
    `;

    // Controls container
    const controls = createNoteControls(noteData);

    header.appendChild(noteNumber);
    header.appendChild(controls);

    return header;

  } catch (error) {
    console.error('[Web Notes] Error creating note header:', error);
    return document.createElement('div');
  }
}

/**
 * Create note controls (delete button, etc.)
 * @param {Object} noteData - Note data
 * @returns {Element} Controls element
 */
function createNoteControls(noteData) {
  try {
    const controls = document.createElement('div');
    controls.className = 'note-controls';

    controls.style.cssText = `
      display: flex !important;
      gap: 4px !important;
      align-items: center !important;
    `;

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '×';
    deleteButton.className = 'note-delete-btn';
    deleteButton.title = 'Delete note';

    deleteButton.style.cssText = `
      background: none !important;
      border: none !important;
      font-size: 18px !important;
      font-weight: bold !important;
      color: rgba(0,0,0,0.5) !important;
      cursor: pointer !important;
      padding: 0 !important;
      margin: 0 !important;
      width: 20px !important;
      height: 20px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 3px !important;
      transition: all 0.15s ease !important;
    `;

    // Delete button hover effects
    deleteButton.addEventListener('mouseenter', () => {
      deleteButton.style.backgroundColor = 'rgba(255,0,0,0.1) !important';
      deleteButton.style.color = '#d32f2f !important';
    });

    deleteButton.addEventListener('mouseleave', () => {
      deleteButton.style.backgroundColor = 'transparent !important';
      deleteButton.style.color = 'rgba(0,0,0,0.5) !important';
    });

    // Delete button click handler
    deleteButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();
      await handleNoteDelete(noteData.id);
    });

    controls.appendChild(deleteButton);

    return controls;

  } catch (error) {
    console.error('[Web Notes] Error creating note controls:', error);
    return document.createElement('div');
  }
}

/**
 * Create note content area
 * @param {Object} noteData - Note data
 * @returns {Element} Content element
 */
function createNoteContent(noteData) {
  try {
    const content = document.createElement('div');
    content.className = 'note-content';

    content.style.cssText = `
      font-size: 14px !important;
      line-height: 1.4 !important;
      color: #333 !important;
      word-wrap: break-word !important;
      max-height: 300px !important;
      overflow-y: auto !important;
    `;

    // Render markdown content
    const renderedContent = MarkdownUtils.renderMarkdown(noteData.content || '');
    content.innerHTML = renderedContent;

    return content;

  } catch (error) {
    console.error('[Web Notes] Error creating note content:', error);
    const fallback = document.createElement('div');
    fallback.textContent = noteData.content || '';
    return fallback;
  }
}

/**
 * Position note based on its data
 * @param {Element} noteElement - Note element
 * @param {Object} noteData - Note data
 * @returns {boolean} True if positioned successfully
 */
function positionNote(noteElement, noteData) {
  try {
    // Try to find anchor element
    if (noteData.cssSelector || noteData.xpath) {
      const targetElement = DOMSelectors.findElementBySelector({
        css: noteData.cssSelector,
        xpath: noteData.xpath
      });

      if (targetElement) {
        const position = NotePositioning.calculateNotePosition(noteData, targetElement);
        if (position) {
          NotePositioning.positionNoteAtCoords(noteElement, position, noteData);
          return true;
        }
      }
    }

    // Fallback to absolute coordinates
    if (noteData.x !== undefined && noteData.y !== undefined) {
      NotePositioning.positionNoteAtCoords(noteElement,
        { x: noteData.x, y: noteData.y }, noteData);
      return true;
    }

    return false;

  } catch (error) {
    console.error('[Web Notes] Error positioning note:', error);
    return false;
  }
}

/**
 * Add interactive capabilities to note
 * @param {Element} noteElement - Note element
 * @param {Object} noteData - Note data
 */
function addNoteCapabilities(noteElement, noteData) {
  try {
    // Find target element for anchoring
    const targetElement = (noteData.cssSelector || noteData.xpath) ?
      DOMSelectors.findElementBySelector({
        css: noteData.cssSelector,
        xpath: noteData.xpath
      }) : null;

    // Add editing capability
    NoteEditing.addEditingCapability(noteElement, noteData);

    // Add dragging capability
    NoteDragging.makeDraggable(noteElement, noteData, targetElement);

    // Add visual effects
    const isAnchored = !!(noteData.cssSelector || noteData.xpath);
    NotePositioning.addInteractiveEffects(noteElement, isAnchored);

  } catch (error) {
    console.error('[Web Notes] Error adding note capabilities:', error);
  }
}

/**
 * Handle note deletion with confirmation
 * @param {string} noteId - Note ID to delete
 */
async function handleNoteDelete(noteId) {
  try {
    // Show confirmation dialog
    const confirmed = await showConfirmDialog(
      'Delete Note',
      'Are you sure you want to delete this note? This action cannot be undone.',
      'Delete',
      'Cancel'
    );

    if (!confirmed) {
      return;
    }

    // Remove from display
    const noteElement = DisplayState.displayedNotes.get(noteId);
    if (noteElement) {
      removeNoteFromDisplay(noteId);
    }

    // Remove text highlight
    SelectionManager.removeTextHighlight(noteId);

    // Delete from storage
    const currentUrl = window.location.href;
    const success = await deleteNote(currentUrl, noteId);

    if (success) {
      console.log(`[Web Notes] Deleted note: ${noteId}`);
      showTemporaryMessage('Note deleted', 'success');
    } else {
      console.error(`[Web Notes] Failed to delete note: ${noteId}`);
      showTemporaryMessage('Failed to delete note', 'error');

      // Re-display the note if deletion failed
      const allNotes = await getNotes();
      const urlNotes = getNotesForUrl(currentUrl, allNotes);
      const noteData = urlNotes.find(note => note.id === noteId);
      if (noteData) {
        displayNote(noteData);
      }
    }

  } catch (error) {
    console.error('[Web Notes] Error handling note deletion:', error);
    showTemporaryMessage('Error deleting note', 'error');
  }
}

/**
 * Remove note from display
 * @param {string} noteId - Note ID to remove
 */
function removeNoteFromDisplay(noteId) {
  try {
    const noteElement = DisplayState.displayedNotes.get(noteId);
    if (!noteElement) {
      return;
    }

    // Fade out animation
    noteElement.style.opacity = '0';

    setTimeout(() => {
      // Remove from DOM
      if (noteElement.parentNode) {
        noteElement.parentNode.removeChild(noteElement);
      }

      // Clean up listeners
      NoteEditing.removeEditingListeners(noteElement);
      NoteDragging.removeDragListeners(noteElement);

      // Remove from tracking
      DisplayState.displayedNotes.delete(noteId);

      console.log(`[Web Notes] Removed note from display: ${noteId}`);

    }, DISPLAY_CONSTANTS.FADE_ANIMATION_DELAY);

  } catch (error) {
    console.error('[Web Notes] Error removing note from display:', error);
  }
}

/**
 * Load and display all notes for current page
 */
async function loadAndDisplayNotes() {
  try {
    if (DisplayState.loadingNotes) {
      console.log('[Web Notes] Already loading notes, skipping');
      return;
    }

    DisplayState.loadingNotes = true;
    const currentUrl = window.location.href;

    console.log(`[Web Notes] Loading notes for URL: ${currentUrl}`);

    // Get all notes from storage
    const allNotes = await getNotes();
    const urlNotes = getNotesForUrl(currentUrl, allNotes);

    console.log(`[Web Notes] Found ${urlNotes.length} notes for current page`);

    // Store for global access
    DisplayState.currentPageNotes = urlNotes;
    window.currentPageNotes = urlNotes; // For other modules

    // Clear existing displayed notes
    clearAllDisplayedNotes();

    // Display each note
    for (const noteData of urlNotes) {
      try {
        await new Promise(resolve => {
          // Small delay between notes for better performance
          setTimeout(() => {
            displayNote(noteData);
            resolve();
          }, 10);
        });
      } catch (noteError) {
        console.error(`[Web Notes] Error displaying note ${noteData.id}:`, noteError);
      }
    }

    // Ensure all notes are visible
    setTimeout(() => {
      const displayedElements = Array.from(DisplayState.displayedNotes.values());
      NotePositioning.ensureAllNotesVisibleBatched(displayedElements, urlNotes);
    }, DISPLAY_CONSTANTS.NOTE_CLEANUP_DELAY);

    DisplayState.isDisplaying = true;

  } catch (error) {
    console.error('[Web Notes] Error loading and displaying notes:', error);
  } finally {
    DisplayState.loadingNotes = false;
  }
}

/**
 * Clear all displayed notes
 */
function clearAllDisplayedNotes() {
  try {
    console.log(`[Web Notes] Clearing ${DisplayState.displayedNotes.size} displayed notes`);

    // Remove all notes from display
    for (const [noteId] of DisplayState.displayedNotes) {
      removeNoteFromDisplay(noteId);
    }

    // Clear highlights
    SelectionManager.clearAllHighlights();

    // Clear state
    DisplayState.displayedNotes.clear();
    DisplayState.currentPageNotes = [];
    DisplayState.isDisplaying = false;

    // Clear global reference
    window.currentPageNotes = [];

  } catch (error) {
    console.error('[Web Notes] Error clearing displayed notes:', error);
  }
}

/**
 * Create a new note at specified coordinates
 * @param {number} noteNumber - Note number for display
 * @param {Object} coords - Coordinates with x, y, and other positioning data
 * @param {string} backgroundColor - Background color for the note
 * @returns {Object|null} Created note data or null if failed
 */
async function createNoteAtCoords(noteNumber, coords, backgroundColor = '#fff3cd') {
  try {
    if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number') {
      console.error('[Web Notes] Invalid coordinates provided');
      return null;
    }

    const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const currentUrl = window.location.href;

    // Create note data
    const noteData = {
      id: noteId,
      noteNumber: noteNumber,
      content: '',
      x: coords.x,
      y: coords.y,
      backgroundColor: SelectionManager.sanitizeColor(backgroundColor),
      createdAt: Date.now(),
      lastEdited: Date.now()
    };

    // Add selection data if available
    if (coords.selectionData) {
      noteData.selectionData = coords.selectionData;
    }

    // Add anchor data if target element is available
    if (coords.target && coords.target !== document.body) {
      const selectors = DOMSelectors.generateOptimalSelector(coords.target);
      if (selectors.css || selectors.xpath) {
        noteData.cssSelector = selectors.css;
        noteData.xpath = selectors.xpath;
        noteData.offsetX = coords.offsetX || 0;
        noteData.offsetY = coords.offsetY || 0;
      }
    }

    // Save to storage
    const success = await addNote(currentUrl, noteData);
    if (!success) {
      console.error('[Web Notes] Failed to save new note to storage');
      return null;
    }

    // Display the note
    const noteElement = displayNote(noteData);
    if (!noteElement) {
      console.error('[Web Notes] Failed to display new note');
      return null;
    }

    // Add to current page notes
    DisplayState.currentPageNotes.push(noteData);
    window.currentPageNotes = DisplayState.currentPageNotes;

    // Enter edit mode immediately for new notes
    setTimeout(() => {
      NoteEditing.enterEditMode(noteElement, noteData);
    }, 100);

    console.log(`[Web Notes] Created new note: ${noteId}`);
    return noteData;

  } catch (error) {
    console.error('[Web Notes] Error creating note at coordinates:', error);
    return null;
  }
}

/**
 * Extract note number from note ID
 * @param {string} noteId - Note ID
 * @returns {number} Extracted note number
 */
function extractNoteNumber(noteId) {
  try {
    const match = noteId.match(/note_(\d+)/);
    return match ? parseInt(match[1]) % 1000 : Math.floor(Math.random() * 1000);
  } catch (error) {
    return Math.floor(Math.random() * 1000);
  }
}

/**
 * Show confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} confirmText - Confirm button text
 * @param {string} cancelText - Cancel button text
 * @returns {Promise<boolean>} Promise resolving to user choice
 */
function showConfirmDialog(title, message, confirmText, cancelText) {
  return new Promise((resolve) => {
    // Use browser's confirm dialog as fallback
    resolve(confirm(`${title}\n\n${message}`));
  });
}

/**
 * Show temporary message to user
 * @param {string} message - Message to show
 * @param {string} type - Message type ('success', 'error', 'info')
 */
function showTemporaryMessage(message, type = 'info') {
  try {
    console.log(`[Web Notes] ${type.toUpperCase()}: ${message}`);

    // TODO: Implement better user notification system
    // For now, just log to console

  } catch (error) {
    console.error('[Web Notes] Error showing temporary message:', error);
  }
}

/**
 * Get currently displayed notes
 * @returns {Map} Map of note IDs to note elements
 */
function getDisplayedNotes() {
  return new Map(DisplayState.displayedNotes);
}

/**
 * Get current page notes data
 * @returns {Array} Array of note data objects
 */
function getCurrentPageNotes() {
  return [...DisplayState.currentPageNotes];
}

/**
 * Check if notes are currently being displayed
 * @returns {boolean} True if displaying notes
 */
function isDisplaying() {
  return DisplayState.isDisplaying;
}

/**
 * Get display statistics
 * @returns {Object} Display statistics
 */
function getDisplayStats() {
  return {
    displayedCount: DisplayState.displayedNotes.size,
    isDisplaying: DisplayState.isDisplaying,
    loadingNotes: DisplayState.loadingNotes,
    currentPageNotesCount: DisplayState.currentPageNotes.length
  };
}

// Export functions for use by other modules
window.NoteDisplay = {
  // Core display functions
  displayNote,
  removeNoteFromDisplay,
  loadAndDisplayNotes,
  clearAllDisplayedNotes,

  // Note creation
  createNoteAtCoords,

  // Note management
  handleNoteDelete,

  // Query functions
  getDisplayedNotes,
  getCurrentPageNotes,
  isDisplaying,
  getDisplayStats,

  // Utility functions
  showConfirmDialog,
  showTemporaryMessage,

  // Constants
  DISPLAY_CONSTANTS
};