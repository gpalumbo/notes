/**
 * Note Editing Module
 * Handles note editing, markdown toolbar functionality, and auto-save features
 */

/* global TIMING, updateNote, createColorDropdown, handleColorSelection */

// Editing state management
const EditingState = {
  currentlyEditingNote: null,
  lastClickTime: 0,
  lastClickedNote: null,
  autosaveTimeouts: new Map(), // Map of noteId -> timeout
};

// Editing constants
const EDITING_CONSTANTS = {
  DOUBLE_CLICK_DELAY: 300,
  AUTOSAVE_DELAY: 1000,
  TOOLBAR_HEIGHT: 40,
  MIN_TEXTAREA_HEIGHT: 60,
  MAX_TEXTAREA_HEIGHT: 400
};

/**
 * Add editing capability to a note element
 * @param {Element} noteElement - Note element
 * @param {Object} noteData - Note data
 */
function addEditingCapability(noteElement, noteData) {
  try {
    if (!noteElement || !noteData) return;

    // Remove existing listeners to prevent duplicates
    removeEditingListeners(noteElement);

    // Add double-click handler for editing
    const handleDoubleClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      enterEditMode(noteElement, noteData);
    };

    // Add click handler for double-click detection
    const handleClick = (event) => {
      const now = Date.now();
      const timeSinceLastClick = now - EditingState.lastClickTime;

      if (
        timeSinceLastClick < EDITING_CONSTANTS.DOUBLE_CLICK_DELAY &&
        EditingState.lastClickedNote === noteElement
      ) {
        // Double-click detected
        handleDoubleClick(event);
      }

      EditingState.lastClickTime = now;
      EditingState.lastClickedNote = noteElement;
    };

    noteElement.addEventListener('click', handleClick);
    noteElement.addEventListener('dblclick', handleDoubleClick);

    // Store listeners for cleanup
    noteElement._editingListeners = {
      click: handleClick,
      dblclick: handleDoubleClick
    };

  } catch (error) {
    console.error('[Web Notes] Error adding editing capability:', error);
  }
}

/**
 * Remove editing listeners from note element
 * @param {Element} noteElement - Note element
 */
function removeEditingListeners(noteElement) {
  try {
    if (noteElement._editingListeners) {
      noteElement.removeEventListener('click', noteElement._editingListeners.click);
      noteElement.removeEventListener('dblclick', noteElement._editingListeners.dblclick);
      delete noteElement._editingListeners;
    }
  } catch (error) {
    console.error('[Web Notes] Error removing editing listeners:', error);
  }
}

/**
 * Enter edit mode for a note
 * @param {Element} noteElement - Note element
 * @param {Object} noteData - Note data
 */
function enterEditMode(noteElement, noteData) {
  try {
    if (!noteElement || !noteData) return;

    // Exit any existing edit mode
    if (EditingState.currentlyEditingNote) {
      exitEditMode(EditingState.currentlyEditingNote);
    }

    EditingState.currentlyEditingNote = noteElement;

    // Get content area
    const contentElement = noteElement.querySelector('.note-content');
    if (!contentElement) {
      console.error('[Web Notes] No content element found for editing');
      return;
    }

    // Store original content
    const originalContent = noteData.content || '';

    // Create textarea for editing
    const textarea = document.createElement('textarea');
    textarea.className = 'note-textarea';
    textarea.value = originalContent;

    // Apply styling
    textarea.style.cssText = `
      width: 100% !important;
      min-height: ${EDITING_CONSTANTS.MIN_TEXTAREA_HEIGHT}px !important;
      max-height: ${EDITING_CONSTANTS.MAX_TEXTAREA_HEIGHT}px !important;
      border: none !important;
      background: transparent !important;
      resize: vertical !important;
      font-family: inherit !important;
      font-size: inherit !important;
      color: inherit !important;
      outline: none !important;
      padding: 0 !important;
      margin: 0 !important;
      box-sizing: border-box !important;
    `;

    // Create markdown toolbar
    const toolbar = createMarkdownToolbar(textarea);

    // Hide original content and show editor
    contentElement.style.display = 'none';
    contentElement.parentNode.insertBefore(toolbar, contentElement);
    contentElement.parentNode.insertBefore(textarea, contentElement);

    // Focus textarea and select content
    textarea.focus();
    textarea.select();

    // Add keyboard handlers
    const keydownHandler = (event) => handleEditKeydown(event, noteElement, noteData, textarea);
    textarea.addEventListener('keydown', keydownHandler);

    // Add auto-save on input
    const inputHandler = () => {
      autoSaveNote(noteElement, noteData, textarea.value);
    };
    textarea.addEventListener('input', inputHandler);

    // Store references for cleanup
    noteElement._editingElements = {
      textarea,
      toolbar,
      originalContent: contentElement,
      keydownHandler,
      inputHandler
    };

    // Auto-resize textarea
    autoResizeTextarea(textarea);
    textarea.addEventListener('input', () => autoResizeTextarea(textarea));

    console.log(`[Web Notes] Entered edit mode for note: ${noteData.id}`);

  } catch (error) {
    console.error('[Web Notes] Error entering edit mode:', error);
  }
}

/**
 * Exit edit mode for a note
 * @param {Element} noteElement - Note element
 * @param {boolean} save - Whether to save changes
 */
function exitEditMode(noteElement, save = true) {
  try {
    if (!noteElement || !noteElement._editingElements) {
      return;
    }

    const {
      textarea,
      toolbar,
      originalContent,
      keydownHandler,
      inputHandler
    } = noteElement._editingElements;

    if (save && textarea) {
      // Save the content
      const newContent = textarea.value;
      const noteId = noteElement.dataset.noteId;

      if (noteId) {
        // Update content immediately in DOM
        if (originalContent) {
          originalContent.innerHTML = window.MarkdownUtils.renderMarkdown(newContent);
        }

        // Save to storage
        const currentUrl = window.location.href;
        updateNote(currentUrl, noteId, { content: newContent })
          .then(success => {
            if (success) {
              console.log(`[Web Notes] Saved note content: ${noteId}`);
            } else {
              console.error(`[Web Notes] Failed to save note: ${noteId}`);
            }
          })
          .catch(error => {
            console.error('[Web Notes] Error saving note:', error);
          });

        // Clear any pending auto-save
        const timeoutId = EditingState.autosaveTimeouts.get(noteId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          EditingState.autosaveTimeouts.delete(noteId);
        }
      }
    }

    // Cleanup UI elements
    if (textarea) {
      textarea.removeEventListener('keydown', keydownHandler);
      textarea.removeEventListener('input', inputHandler);
      textarea.remove();
    }

    if (toolbar) {
      toolbar.remove();
    }

    if (originalContent) {
      originalContent.style.display = '';
    }

    // Clear references
    delete noteElement._editingElements;
    EditingState.currentlyEditingNote = null;

    console.log(`[Web Notes] Exited edit mode`);

  } catch (error) {
    console.error('[Web Notes] Error exiting edit mode:', error);
  }
}

/**
 * Handle keyboard events during editing
 * @param {KeyboardEvent} event - Keyboard event
 * @param {Element} noteElement - Note element
 * @param {Object} noteData - Note data
 * @param {Element} textarea - Textarea element
 */
function handleEditKeydown(event, noteElement, noteData, textarea) {
  try {
    // Save and exit on Ctrl+Enter or Cmd+Enter
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      exitEditMode(noteElement, true);
      return;
    }

    // Cancel on Escape
    if (event.key === 'Escape') {
      event.preventDefault();
      exitEditMode(noteElement, false);
      return;
    }

    // Markdown shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'b':
          event.preventDefault();
          insertMarkdownSyntax(textarea, '**', '**');
          break;
        case 'i':
          event.preventDefault();
          insertMarkdownSyntax(textarea, '*', '*');
          break;
        case 'k':
          event.preventDefault();
          insertMarkdownLink(textarea);
          break;
      }
    }

  } catch (error) {
    console.error('[Web Notes] Error handling edit keydown:', error);
  }
}

/**
 * Create markdown toolbar for editing
 * @param {Element} textarea - Textarea element
 * @returns {Element} Toolbar element
 */
function createMarkdownToolbar(textarea) {
  try {
    const toolbar = document.createElement('div');
    toolbar.className = 'markdown-toolbar';

    toolbar.style.cssText = `
      display: flex !important;
      align-items: center !important;
      padding: 8px !important;
      background: #f8f9fa !important;
      border-bottom: 1px solid #dee2e6 !important;
      border-radius: 4px 4px 0 0 !important;
      gap: 8px !important;
      font-size: 12px !important;
      flex-wrap: wrap !important;
    `;

    // Toolbar buttons configuration
    const buttons = [
      { text: 'B', title: 'Bold (Ctrl+B)', action: () => insertMarkdownSyntax(textarea, '**', '**') },
      { text: 'I', title: 'Italic (Ctrl+I)', action: () => insertMarkdownSyntax(textarea, '*', '*') },
      { text: 'H1', title: 'Heading 1', action: () => insertLinePrefix(textarea, '# ') },
      { text: 'H2', title: 'Heading 2', action: () => insertLinePrefix(textarea, '## ') },
      { text: 'H3', title: 'Heading 3', action: () => insertLinePrefix(textarea, '### ') },
      { text: '•', title: 'Bullet List', action: () => insertLinePrefix(textarea, '- ') },
      { text: '1.', title: 'Numbered List', action: () => insertOrderedListItem(textarea) },
      { text: 'Link', title: 'Link (Ctrl+K)', action: () => insertMarkdownLink(textarea) },
      { text: 'Code', title: 'Code', action: () => insertMarkdownSyntax(textarea, '`', '`') },
      { text: 'Quote', title: 'Quote', action: () => insertLinePrefix(textarea, '> ') },
    ];

    // Create buttons
    buttons.forEach(buttonConfig => {
      const button = document.createElement('button');
      button.textContent = buttonConfig.text;
      button.title = buttonConfig.title;
      button.type = 'button';

      button.style.cssText = `
        border: 1px solid #dee2e6 !important;
        background: white !important;
        padding: 4px 8px !important;
        border-radius: 3px !important;
        cursor: pointer !important;
        font-size: 11px !important;
        font-weight: bold !important;
        color: #495057 !important;
        transition: all 0.15s ease !important;
      `;

      // Hover effects
      button.addEventListener('mouseenter', () => {
        button.style.background = '#e9ecef !important';
        button.style.borderColor = '#adb5bd !important';
      });

      button.addEventListener('mouseleave', () => {
        button.style.background = 'white !important';
        button.style.borderColor = '#dee2e6 !important';
      });

      // Click handler
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        buttonConfig.action();
        textarea.focus();
      });

      toolbar.appendChild(button);
    });

    // Add color selector
    const colorSelector = createColorSelector(textarea);
    toolbar.appendChild(colorSelector);

    return toolbar;

  } catch (error) {
    console.error('[Web Notes] Error creating markdown toolbar:', error);
    return document.createElement('div');
  }
}

/**
 * Create color selector for note background
 * @param {Element} textarea - Textarea element
 * @returns {Element} Color selector element
 */
function createColorSelector(textarea) {
  try {
    const colorButton = document.createElement('button');
    colorButton.textContent = '🎨';
    colorButton.title = 'Change Note Color';
    colorButton.type = 'button';

    colorButton.style.cssText = `
      border: 1px solid #dee2e6 !important;
      background: white !important;
      padding: 4px 8px !important;
      border-radius: 3px !important;
      cursor: pointer !important;
      font-size: 11px !important;
      transition: all 0.15s ease !important;
    `;

    colorButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      // Get note element
      const noteElement = textarea.closest('.web-notes-note');
      if (noteElement) {
        const rect = colorButton.getBoundingClientRect();
        createColorDropdown(rect.left, rect.bottom + 5, (color) => {
          handleColorSelection(noteElement, color);
        });
      }
    });

    return colorButton;

  } catch (error) {
    console.error('[Web Notes] Error creating color selector:', error);
    return document.createElement('div');
  }
}

/**
 * Insert markdown syntax around selected text
 * @param {Element} textarea - Textarea element
 * @param {string} before - Text to insert before selection
 * @param {string} after - Text to insert after selection
 */
function insertMarkdownSyntax(textarea, before, after) {
  try {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const replacement = before + selectedText + after;

    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);

    // Update cursor position
    if (selectedText) {
      textarea.setSelectionRange(start, start + replacement.length);
    } else {
      textarea.setSelectionRange(start + before.length, start + before.length);
    }

    // Trigger input event for auto-save
    textarea.dispatchEvent(new Event('input'));

  } catch (error) {
    console.error('[Web Notes] Error inserting markdown syntax:', error);
  }
}

/**
 * Insert line prefix for markdown formatting
 * @param {Element} textarea - Textarea element
 * @param {string} prefix - Prefix to insert
 */
function insertLinePrefix(textarea, prefix) {
  try {
    const start = textarea.selectionStart;
    const value = textarea.value;

    // Find the start of the current line
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', start);
    const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;

    const currentLine = value.substring(lineStart, actualLineEnd);

    // Check if prefix already exists
    if (currentLine.startsWith(prefix)) {
      // Remove prefix
      const newLine = currentLine.substring(prefix.length);
      textarea.value = value.substring(0, lineStart) + newLine + value.substring(actualLineEnd);
      textarea.setSelectionRange(start - prefix.length, start - prefix.length);
    } else {
      // Add prefix
      const newLine = prefix + currentLine;
      textarea.value = value.substring(0, lineStart) + newLine + value.substring(actualLineEnd);
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }

    // Trigger input event for auto-save
    textarea.dispatchEvent(new Event('input'));

  } catch (error) {
    console.error('[Web Notes] Error inserting line prefix:', error);
  }
}

/**
 * Insert ordered list item with auto-incrementing numbers
 * @param {Element} textarea - Textarea element
 */
function insertOrderedListItem(textarea) {
  try {
    const start = textarea.selectionStart;
    const value = textarea.value;

    // Find the start of the current line
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', start);
    const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;

    const currentLine = value.substring(lineStart, actualLineEnd);

    // Check for existing numbered list pattern
    const numberedListPattern = /^(\d+)\.\s*/;
    const match = currentLine.match(numberedListPattern);

    if (match) {
      // Remove numbering
      const newLine = currentLine.replace(numberedListPattern, '');
      textarea.value = value.substring(0, lineStart) + newLine + value.substring(actualLineEnd);
      const adjustment = match[0].length;
      textarea.setSelectionRange(start - adjustment, start - adjustment);
    } else {
      // Add numbering - find the appropriate number
      let number = 1;

      // Look for previous numbered items
      const previousLines = value.substring(0, lineStart).split('\n');
      for (let i = previousLines.length - 1; i >= 0; i--) {
        const prevMatch = previousLines[i].match(numberedListPattern);
        if (prevMatch) {
          number = parseInt(prevMatch[1]) + 1;
          break;
        }
        if (previousLines[i].trim() === '') {
          continue; // Skip empty lines
        }
        break; // Stop at non-empty, non-numbered line
      }

      const prefix = `${number}. `;
      const newLine = prefix + currentLine;
      textarea.value = value.substring(0, lineStart) + newLine + value.substring(actualLineEnd);
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }

    // Trigger input event for auto-save
    textarea.dispatchEvent(new Event('input'));

  } catch (error) {
    console.error('[Web Notes] Error inserting ordered list item:', error);
  }
}

/**
 * Insert markdown link
 * @param {Element} textarea - Textarea element
 */
function insertMarkdownLink(textarea) {
  try {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    let linkText = selectedText || 'link text';
    let url = 'https://';

    // If selected text looks like a URL, use it as the URL
    if (selectedText && (selectedText.startsWith('http://') || selectedText.startsWith('https://'))) {
      url = selectedText;
      linkText = 'link text';
    }

    const replacement = `[${linkText}](${url})`;

    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);

    // Position cursor at the URL part
    const urlStart = start + linkText.length + 3; // After "[linkText]("
    textarea.setSelectionRange(urlStart, urlStart + url.length);

    // Trigger input event for auto-save
    textarea.dispatchEvent(new Event('input'));

  } catch (error) {
    console.error('[Web Notes] Error inserting markdown link:', error);
  }
}

/**
 * Auto-save note content with debouncing
 * @param {Element} noteElement - Note element
 * @param {Object} noteData - Note data
 * @param {string} content - New content
 */
function autoSaveNote(noteElement, noteData, content) {
  try {
    const noteId = noteData.id;

    // Clear existing timeout
    const existingTimeout = EditingState.autosaveTimeouts.get(noteId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeoutId = setTimeout(async () => {
      try {
        const currentUrl = window.location.href;
        const success = await updateNote(currentUrl, noteId, { content });

        if (success) {
          console.log(`[Web Notes] Auto-saved note: ${noteId}`);

          // Update the display content immediately
          const contentElement = noteElement.querySelector('.note-content');
          if (contentElement) {
            contentElement.innerHTML = window.MarkdownUtils.renderMarkdown(content);
          }
        } else {
          console.warn(`[Web Notes] Auto-save failed for note: ${noteId}`);
        }

        EditingState.autosaveTimeouts.delete(noteId);
      } catch (error) {
        console.error('[Web Notes] Error in auto-save:', error);
        EditingState.autosaveTimeouts.delete(noteId);
      }
    }, EDITING_CONSTANTS.AUTOSAVE_DELAY);

    EditingState.autosaveTimeouts.set(noteId, timeoutId);

  } catch (error) {
    console.error('[Web Notes] Error setting up auto-save:', error);
  }
}

/**
 * Auto-resize textarea based on content
 * @param {Element} textarea - Textarea element
 */
function autoResizeTextarea(textarea) {
  try {
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate new height
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, EDITING_CONSTANTS.MIN_TEXTAREA_HEIGHT),
      EDITING_CONSTANTS.MAX_TEXTAREA_HEIGHT
    );

    textarea.style.height = `${newHeight}px`;

  } catch (error) {
    console.error('[Web Notes] Error auto-resizing textarea:', error);
  }
}

/**
 * Check if a note is currently being edited
 * @param {Element} noteElement - Note element
 * @returns {boolean} True if note is being edited
 */
function isNoteBeingEdited(noteElement) {
  return EditingState.currentlyEditingNote === noteElement;
}

/**
 * Get currently editing note element
 * @returns {Element|null} Currently editing note element
 */
function getCurrentlyEditingNote() {
  return EditingState.currentlyEditingNote;
}

// Export functions for use by other modules
window.NoteEditing = {
  // Core editing functions
  addEditingCapability,
  enterEditMode,
  exitEditMode,
  removeEditingListeners,

  // Markdown functions
  insertMarkdownSyntax,
  insertLinePrefix,
  insertOrderedListItem,
  insertMarkdownLink,

  // Auto-save and utility functions
  autoSaveNote,
  autoResizeTextarea,

  // State queries
  isNoteBeingEdited,
  getCurrentlyEditingNote,

  // Toolbar creation
  createMarkdownToolbar,

  // Constants and state
  EDITING_CONSTANTS,
  EditingState
};