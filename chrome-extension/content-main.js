/**
 * Content Script Main Coordinator
 * Orchestrates all Web Notes functionality and manages the extension lifecycle
 */

/* global EXTENSION_CONSTANTS, SelectionManager, DOMSelectors, NotePositioning */
/* global NoteEditing, NoteDragging, URLMonitor, NoteDisplay, TIMING */

// Main coordinator state
const MainState = {
  isInitialized: false,
  lastRightClickCoords: null,
  isCleanupInProgress: false
};

// Main constants
const MAIN_CONSTANTS = {
  INITIALIZATION_DELAY: 100,
  CLEANUP_DELAY: 1000,
  CONTEXT_MENU_TIMEOUT: 5000, // How long to keep right-click coordinates
  MAX_INITIALIZATION_ATTEMPTS: 3
};

console.log('[Web Notes] Content script main coordinator loading...');

/**
 * Initialize the Web Notes extension
 */
async function initializeWebNotes() {
  try {
    if (MainState.isInitialized) {
      console.log('[Web Notes] Already initialized, skipping');
      return;
    }

    console.log('[Web Notes] Initializing Web Notes extension...');

    // Initialize all modules
    await initializeModules();

    // Set up event listeners
    setupEventListeners();

    // Start URL monitoring
    startPageMonitoring();

    // Load and display notes for current page
    await NoteDisplay.loadAndDisplayNotes();

    MainState.isInitialized = true;
    console.log('[Web Notes] Web Notes extension initialized successfully');

  } catch (error) {
    console.error('[Web Notes] Error initializing Web Notes:', error);
    // Attempt to cleanup on failed initialization
    setTimeout(cleanup, MAIN_CONSTANTS.CLEANUP_DELAY);
  }
}

/**
 * Initialize all modules
 */
async function initializeModules() {
  try {
    console.log('[Web Notes] Initializing modules...');

    // Verify all required modules are loaded
    const requiredModules = [
      'SelectionManager',
      'DOMSelectors',
      'NotePositioning',
      'NoteEditing',
      'NoteDragging',
      'URLMonitor',
      'NoteDisplay'
    ];

    for (const moduleName of requiredModules) {
      if (!window[moduleName]) {
        throw new Error(`Required module ${moduleName} not found`);
      }
    }

    // Initialize DOM selectors cache
    DOMSelectors.clearElementCache();

    console.log('[Web Notes] All modules verified and initialized');

  } catch (error) {
    console.error('[Web Notes] Error initializing modules:', error);
    throw error;
  }
}

/**
 * Set up main event listeners
 */
function setupEventListeners() {
  try {
    console.log('[Web Notes] Setting up event listeners...');

    // Context menu listener for note creation
    document.addEventListener('contextmenu', handleContextMenu);

    // Message listener for communication with background script
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    // Page visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Beforeunload listener for cleanup
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    console.log('[Web Notes] Event listeners set up successfully');

  } catch (error) {
    console.error('[Web Notes] Error setting up event listeners:', error);
  }
}

/**
 * Start page monitoring for URL changes
 */
function startPageMonitoring() {
  try {
    console.log('[Web Notes] Starting page monitoring...');

    // Start URL monitoring with callback
    URLMonitor.startUrlMonitoring(async (oldUrl, newUrl) => {
      console.log(`[Web Notes] URL changed: ${oldUrl} -> ${newUrl}`);

      // Clear current notes
      NoteDisplay.clearAllDisplayedNotes();

      // Load notes for new URL
      await NoteDisplay.loadAndDisplayNotes();
    });

    console.log('[Web Notes] Page monitoring started');

  } catch (error) {
    console.error('[Web Notes] Error starting page monitoring:', error);
  }
}

/**
 * Handle context menu events for note creation
 * @param {MouseEvent} event - Context menu event
 */
function handleContextMenu(event) {
  try {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Store coordinates and selection data
    MainState.lastRightClickCoords = {
      x: event.pageX,
      y: event.pageY,
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.target,
      timestamp: Date.now(),
      selectedText: selectedText,
      selectionData: selectedText ? SelectionManager.captureSelectionData(selection) : null,
    };

    // Clear coordinates after timeout to prevent stale data
    setTimeout(() => {
      if (MainState.lastRightClickCoords &&
          Date.now() - MainState.lastRightClickCoords.timestamp > MAIN_CONSTANTS.CONTEXT_MENU_TIMEOUT) {
        MainState.lastRightClickCoords = null;
      }
    }, MAIN_CONSTANTS.CONTEXT_MENU_TIMEOUT);

  } catch (error) {
    console.error('[Web Notes] Error handling context menu:', error);
  }
}

/**
 * Handle runtime messages from background script
 * @param {Object} request - Message request
 * @param {Object} sender - Message sender
 * @param {Function} sendResponse - Response function
 */
function handleRuntimeMessage(request, sender, sendResponse) {
  try {
    console.log('[Web Notes] Received runtime message:', request);

    switch (request.action) {
      case 'createNote':
        handleCreateNoteRequest(request, sendResponse);
        break;

      case 'getPageInfo':
        handleGetPageInfoRequest(sendResponse);
        break;

      case 'reloadNotes':
        handleReloadNotesRequest(sendResponse);
        break;

      case 'cleanup':
        handleCleanupRequest(sendResponse);
        break;

      default:
        console.warn('[Web Notes] Unknown runtime message action:', request.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }

    // Return true to indicate async response
    return true;

  } catch (error) {
    console.error('[Web Notes] Error handling runtime message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle create note request from background script
 * @param {Object} request - Create note request
 * @param {Function} sendResponse - Response function
 */
async function handleCreateNoteRequest(request, sendResponse) {
  try {
    if (!MainState.lastRightClickCoords) {
      sendResponse({
        success: false,
        error: 'No recent right-click coordinates found'
      });
      return;
    }

    const coords = MainState.lastRightClickCoords;
    const backgroundColor = request.backgroundColor || '#fff3cd';

    // Generate note number
    const currentNotes = NoteDisplay.getCurrentPageNotes();
    const noteNumber = currentNotes.length + 1;

    // Create the note
    const noteData = await NoteDisplay.createNoteAtCoords(noteNumber, coords, backgroundColor);

    if (noteData) {
      sendResponse({
        success: true,
        noteId: noteData.id,
        message: 'Note created successfully'
      });
    } else {
      sendResponse({
        success: false,
        error: 'Failed to create note'
      });
    }

  } catch (error) {
    console.error('[Web Notes] Error creating note:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle get page info request
 * @param {Function} sendResponse - Response function
 */
function handleGetPageInfoRequest(sendResponse) {
  try {
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      notesCount: NoteDisplay.getCurrentPageNotes().length,
      displayedNotesCount: NoteDisplay.getDisplayedNotes().size,
      isInitialized: MainState.isInitialized,
      timestamp: Date.now()
    };

    sendResponse({ success: true, pageInfo });

  } catch (error) {
    console.error('[Web Notes] Error getting page info:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle reload notes request
 * @param {Function} sendResponse - Response function
 */
async function handleReloadNotesRequest(sendResponse) {
  try {
    console.log('[Web Notes] Reloading notes...');

    // Clear current notes
    NoteDisplay.clearAllDisplayedNotes();

    // Reload notes
    await NoteDisplay.loadAndDisplayNotes();

    sendResponse({
      success: true,
      notesCount: NoteDisplay.getCurrentPageNotes().length,
      message: 'Notes reloaded successfully'
    });

  } catch (error) {
    console.error('[Web Notes] Error reloading notes:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle cleanup request
 * @param {Function} sendResponse - Response function
 */
async function handleCleanupRequest(sendResponse) {
  try {
    await cleanup();
    sendResponse({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    console.error('[Web Notes] Error during cleanup:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle visibility change events
 */
function handleVisibilityChange() {
  try {
    if (document.hidden) {
      console.log('[Web Notes] Page hidden, pausing operations');

      // Exit any active editing mode
      const currentlyEditing = NoteEditing.getCurrentlyEditingNote();
      if (currentlyEditing) {
        NoteEditing.exitEditMode(currentlyEditing, true);
      }

    } else {
      console.log('[Web Notes] Page visible, resuming operations');

      // Reposition notes in case layout changed
      setTimeout(() => {
        NotePositioning.repositionAllNotes();
      }, 100);
    }

  } catch (error) {
    console.error('[Web Notes] Error handling visibility change:', error);
  }
}

/**
 * Handle before unload events
 */
function handleBeforeUnload() {
  try {
    console.log('[Web Notes] Page unloading, cleaning up...');

    // Exit any active editing mode
    const currentlyEditing = NoteEditing.getCurrentlyEditingNote();
    if (currentlyEditing) {
      NoteEditing.exitEditMode(currentlyEditing, true);
    }

    // Clear any pending auto-save timeouts
    for (const [noteId, timeoutId] of NoteEditing.EditingState.autosaveTimeouts) {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    console.error('[Web Notes] Error handling before unload:', error);
  }
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyboardShortcuts(event) {
  try {
    // Escape key to exit editing or cancel dragging
    if (event.key === 'Escape') {

      // Exit editing mode if active
      const currentlyEditing = NoteEditing.getCurrentlyEditingNote();
      if (currentlyEditing) {
        NoteEditing.exitEditMode(currentlyEditing, false);
        event.preventDefault();
        return;
      }

      // Cancel dragging if active
      if (NoteDragging.isDragging()) {
        // Dragging module handles escape internally
        event.preventDefault();
        return;
      }
    }

    // Ctrl+Alt+N to create new note (if not in input field)
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.key === 'n') {
      const target = event.target;

      // Don't trigger if user is typing in an input field
      if (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.contentEditable === 'true') {
        return;
      }

      event.preventDefault();

      // Create note at center of viewport
      const viewportCenter = {
        x: window.pageXOffset + window.innerWidth / 2,
        y: window.pageYOffset + window.innerHeight / 2,
        target: document.body,
        timestamp: Date.now()
      };

      const currentNotes = NoteDisplay.getCurrentPageNotes();
      const noteNumber = currentNotes.length + 1;

      NoteDisplay.createNoteAtCoords(noteNumber, viewportCenter);
    }

  } catch (error) {
    console.error('[Web Notes] Error handling keyboard shortcuts:', error);
  }
}

/**
 * Cleanup function to remove all notes and listeners
 */
async function cleanup() {
  try {
    if (MainState.isCleanupInProgress) {
      console.log('[Web Notes] Cleanup already in progress, skipping');
      return;
    }

    MainState.isCleanupInProgress = true;
    console.log('[Web Notes] Starting cleanup...');

    // Exit any active editing mode
    const currentlyEditing = NoteEditing.getCurrentlyEditingNote();
    if (currentlyEditing) {
      NoteEditing.exitEditMode(currentlyEditing, true);
    }

    // Clear all displayed notes
    NoteDisplay.clearAllDisplayedNotes();

    // Stop URL monitoring
    URLMonitor.stopUrlMonitoring();

    // Clear DOM selectors cache
    DOMSelectors.clearElementCache();

    // Remove event listeners
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('keydown', handleKeyboardShortcuts);
    window.removeEventListener('beforeunload', handleBeforeUnload);

    // Remove runtime message listener
    if (chrome.runtime.onMessage.hasListener(handleRuntimeMessage)) {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    }

    // Clear state
    MainState.isInitialized = false;
    MainState.lastRightClickCoords = null;

    console.log('[Web Notes] Cleanup completed');

  } catch (error) {
    console.error('[Web Notes] Error during cleanup:', error);
  } finally {
    MainState.isCleanupInProgress = false;
  }
}

/**
 * Get extension status for debugging
 * @returns {Object} Status object
 */
function getExtensionStatus() {
  try {
    return {
      isInitialized: MainState.isInitialized,
      isCleanupInProgress: MainState.isCleanupInProgress,
      hasLastRightClick: !!MainState.lastRightClickCoords,
      currentUrl: URLMonitor.getCurrentUrl(),
      isUrlMonitoring: URLMonitor.isMonitoring(),
      notesCount: NoteDisplay.getCurrentPageNotes().length,
      displayedNotesCount: NoteDisplay.getDisplayedNotes().size,
      isDisplaying: NoteDisplay.isDisplaying(),
      isDragging: NoteDragging.isDragging(),
      currentlyEditing: !!NoteEditing.getCurrentlyEditingNote(),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[Web Notes] Error getting extension status:', error);
    return { error: error.message };
  }
}

/**
 * Initialize with retry logic
 */
async function initializeWithRetry() {
  let attempts = 0;

  while (attempts < MAIN_CONSTANTS.MAX_INITIALIZATION_ATTEMPTS) {
    try {
      await initializeWebNotes();
      return; // Success
    } catch (error) {
      attempts++;
      console.error(`[Web Notes] Initialization attempt ${attempts} failed:`, error);

      if (attempts < MAIN_CONSTANTS.MAX_INITIALIZATION_ATTEMPTS) {
        console.log(`[Web Notes] Retrying initialization in ${MAIN_CONSTANTS.INITIALIZATION_DELAY * attempts}ms...`);
        await new Promise(resolve => setTimeout(resolve, MAIN_CONSTANTS.INITIALIZATION_DELAY * attempts));
      } else {
        console.error('[Web Notes] All initialization attempts failed');
        throw error;
      }
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeWithRetry, MAIN_CONSTANTS.INITIALIZATION_DELAY);
  });
} else {
  // DOM already loaded
  setTimeout(initializeWithRetry, MAIN_CONSTANTS.INITIALIZATION_DELAY);
}

// Export main functions for debugging and testing
window.WebNotesMain = {
  // Core functions
  initializeWebNotes,
  cleanup,
  getExtensionStatus,

  // Event handlers (for testing)
  handleContextMenu,
  handleRuntimeMessage,

  // Utility functions
  initializeWithRetry,

  // State access (for debugging)
  MainState,
  MAIN_CONSTANTS
};

console.log('[Web Notes] Content script main coordinator loaded successfully');