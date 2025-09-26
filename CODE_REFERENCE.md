# Code Navigation Reference

This file provides compact code navigation for the Web Notes Chrome extension project. Load on-demand when exploring or debugging code.

## 📁 Project Structure

```
notes/
├── 📂 chrome-extension/         # Chrome extension source code
│   ├── manifest.json           # Extension configuration and permissions
│   ├── background.js           # Service worker - context menu & stats
│   ├── popup.js/html           # Extension popup interface
│   ├── 📦 Core Modules (Refactored Architecture)
│   │   ├── content-main.js     # Main coordinator - orchestrates all functionality
│   │   ├── selection-manager.js # Text selection capture and highlighting
│   │   ├── dom-selectors.js    # CSS/XPath selector generation and element finding
│   │   ├── note-positioning.js # Note positioning, anchoring, and visibility
│   │   ├── note-editing.js     # Note editing, markdown toolbar, and auto-save
│   │   ├── note-dragging.js    # Drag and drop functionality with anchor detection
│   │   ├── url-monitor.js      # URL change detection for single-page apps
│   │   └── note-display.js     # Note creation, display, and lifecycle management
│   ├── 📦 Utility Modules
│   │   ├── color-utils.js      # Centralized color management system
│   │   ├── color-dropdown.js   # Color dropdown component for edit toolbar
│   │   ├── markdown-utils.js   # Markdown parsing and rendering utilities
│   │   └── shared-utils.js     # Constants and storage utilities
│   ├── content.js              # [DEPRECATED] Legacy monolithic file (2400+ lines)
│   └── README.md               # Installation guide
├── 📂 backend/                  # FastAPI backend source code
│   └── app/main.py             # FastAPI application entry point
├── 📂 tests/                    # Test suite
│   ├── conftest.py             # Pytest fixtures
│   └── test_main.py            # FastAPI endpoint tests
├── 📂 scripts/                  # Development automation
│   ├── dev.sh                  # Universal development server
│   └── package-extension.sh    # Chrome Web Store packaging script
└── ⚙️ Configuration Files
    ├── Makefile                # Development workflow commands
    ├── pyproject.toml          # Python packaging and tool config
    ├── .pre-commit-config.yaml # Git hooks for code quality
    └── PUBLISHING.md           # Chrome Web Store submission guide
```

## 🏗️ Refactored Module Architecture

### Module Loading Order (manifest.json)
1. **Third-party Libraries**: marked.min.js, dompurify.min.js
2. **Utility Modules**: color-utils.js, color-dropdown.js, markdown-utils.js, shared-utils.js
3. **Core Modules**: selection-manager.js → dom-selectors.js → note-positioning.js → note-editing.js → note-dragging.js → url-monitor.js → note-display.js
4. **Main Coordinator**: content-main.js

### Core Module Responsibilities

#### content-main.js (Main Coordinator)
- **Purpose**: Orchestrates all extension functionality and manages lifecycle
- **Key Functions**:
  - `initializeWebNotes()` - Initialize all modules and set up event listeners
  - `handleContextMenu()` - Process right-click events for note creation
  - `handleRuntimeMessage()` - Communication with background script
  - `cleanup()` - Clean up all resources on page unload
- **Global Export**: `window.WebNotesMain`

#### selection-manager.js (Text Selection & Highlighting)
- **Purpose**: Handles text selection capture and highlighting management
- **Key Functions**:
  - `captureSelectionData()` - Capture comprehensive selection information
  - `createTextHighlight()` - Create visual highlights for selected text
  - `removeTextHighlight()` - Remove highlights when notes are deleted
  - `sanitizeColor()` - Validate color values for security
- **Global Export**: `window.SelectionManager`

#### dom-selectors.js (DOM Utilities)
- **Purpose**: CSS/XPath selector generation and element finding with caching
- **Key Functions**:
  - `generateOptimalSelector()` - Create CSS and XPath selectors for elements
  - `findElementBySelector()` - Find elements using cached selectors
  - `findTextNodeInElement()` - Locate text nodes for highlighting
  - **Element Cache**: Performance optimization with size management
- **Global Export**: `window.DOMSelectors`

#### note-positioning.js (Positioning & Anchoring)
- **Purpose**: Note positioning, anchoring to elements, and visibility management
- **Key Functions**:
  - `ensureNoteVisibility()` - Keep notes within viewport bounds
  - `repositionAllNotes()` - Reposition notes on layout changes
  - `calculateNotePosition()` - Compute note position relative to anchors
  - `addInteractiveEffects()` - Visual feedback and hover effects
- **Global Export**: `window.NotePositioning`

#### note-editing.js (Editing & Toolbar)
- **Purpose**: Note editing interface, markdown toolbar, and auto-save functionality
- **Key Functions**:
  - `enterEditMode()/exitEditMode()` - Switch between view and edit modes
  - `createMarkdownToolbar()` - Rich editing toolbar with markdown shortcuts
  - `autoSaveNote()` - Debounced auto-save during editing
  - `insertMarkdownSyntax()` - Helper functions for markdown formatting
- **Global Export**: `window.NoteEditing`
- **Keyboard Shortcuts**: Ctrl+B (bold), Ctrl+I (italic), Ctrl+K (link), Escape (exit)

#### note-dragging.js (Drag & Drop)
- **Purpose**: Drag and drop functionality with intelligent anchoring
- **Key Functions**:
  - `makeDraggable()` - Add drag capability to notes
  - `startDrag()/finishDrag()` - Drag lifecycle management
  - `findNearestAnchorElement()` - Auto-anchor to suitable elements
  - `handleAutoScroll()` - Scroll viewport during drag near edges
- **Global Export**: `window.NoteDragging`
- **Features**: Visual feedback, drop target highlighting, anchor detection

#### url-monitor.js (Navigation Detection)
- **Purpose**: URL change detection for single-page applications
- **Key Functions**:
  - `startUrlMonitoring()` - Monitor URL changes with callbacks
  - `checkUrlChange()` - Detect navigation events and URL changes
  - **Navigation Events**: popstate, pushstate, replacestate, hashchange
  - **Mutation Observer**: Detect DOM changes indicating navigation
- **Global Export**: `window.URLMonitor`

#### note-display.js (Display & Lifecycle)
- **Purpose**: Note creation, display, lifecycle management, and deletion
- **Key Functions**:
  - `displayNote()` - Render note with full functionality
  - `createNoteAtCoords()` - Create new notes at specific locations
  - `loadAndDisplayNotes()` - Load and display all notes for current page
  - `handleNoteDelete()` - Delete notes with confirmation
- **Global Export**: `window.NoteDisplay`
- **Features**: Fade animations, cleanup management, batch operations

### Module Communication Patterns
- **Global Exports**: Each module exports functions via `window.ModuleName`
- **Shared State**: `window.currentPageNotes` for current page note data
- **Event Coordination**: Main coordinator manages cross-module events
- **Error Isolation**: Each module handles its own errors independently

## 🔧 Key Functions & Constants

### Extension Background.js
- `showWebNotesBanner()` - Creates draggable notes with markdown support
- `getStats()/setStats()` - Extension usage tracking
- `STATS_KEY: 'extensionStats'` - Storage key
- `SCRIPT_INJECTION_TIMEOUT: 5000` - Script timeout

### Extension Popup.js
- `updateStatsDisplay()` - Shows usage statistics
- `executeScriptInTab()` - Script injection with timeout
- Buttons: show-banner, hide-banner, clear-stats

### Extension Shared-utils.js
- `EXTENSION_ID: 'show-web-notes-banner'`
- `MENU_TITLE: '🗒️ Show Web Notes Banner'`
- `DEFAULT_STATS` - Statistics object structure

### Extension Color-utils.js
- `NoteColorUtils.getColorOptions()` - Returns array of available colors
- `NoteColorUtils.getColorValue(colorName)` - Get hex value from color name
- `NoteColorUtils.isValidColor(colorName)` - Validate color name
- `NoteColorUtils.getDefaultColor()` - Returns default color name
- **8 Colors**: light-yellow, light-blue, light-green, light-red, light-purple, light-orange, light-gray, teal

### Extension Color-dropdown.js
- `createColorDropdown(textarea)` - Creates color dropdown component
- `handleColorSelection(colorName, textarea)` - Processes color selection
- `toggleColorDropdown(menu)` - Shows/hides color dropdown
- Integrated into edit mode toolbar for background color selection

### Backend API (main.py)
- `GET /` - Hello world endpoint
- `GET /api/health` - Health check
- CORS enabled for chrome-extension:// origins
- FastAPI app with uvicorn server on localhost:8000

## 🔄 Development Commands

### Setup & Development
- `make setup` - Environment preparation
- `make dev` - Start FastAPI server (localhost:8000)
- `./scripts/dev.sh` - Alternative development server

### Testing & Quality
- `make test` - Run test suite with coverage
- `make lint` - Code quality checks (black, isort, flake8, mypy)
- `make format` - Auto-format code

### Extension Testing
- Load extension in Chrome developer mode from `chrome-extension/` folder
- Right-click → "Show Web Notes Banner" to test context menu
- Test on chrome:// pages (should show error)

### Extension Packaging & Publishing
- `make package-extension` - Create Chrome Web Store package
- `make validate-extension` - Validate extension structure and manifest
- `make package-info` - Show extension package information
- `./scripts/package-extension.sh` - Direct packaging script execution
- Package output: `dist/web-notes-extension-v1.0.0.zip`
- Full publishing guide: See `PUBLISHING.md`

## 📦 Dependencies & Configuration

### Python Dependencies
- **Production**: fastapi, uvicorn, python-multipart
- **Development**: black, isort, flake8, mypy, pytest, pre-commit

### Extension Permissions
- `activeTab` - Access to current tab
- `storage` - Local storage access
- `scripting` - Script injection capability
- `contextMenus` - Right-click menu creation

### Key Configuration Files
- `pyproject.toml` - Modern Python packaging, tool settings
- `manifest.json` - Extension permissions, entry points
- `.pre-commit-config.yaml` - Git hooks for code quality
- `Makefile` - Cross-platform development commands

## 🔒 Security Features

- **XSS Prevention**: No innerHTML usage, createElement/textContent only (maintained in all modules)
- **Content Security Policy**: Configured in manifest.json
- **Tab Validation**: Restricts chrome:// and extension URLs
- **Error Handling**: Try-catch blocks, timeout protection in each module
- **Input Sanitization**: Color validation, XPath validation, CSS selector escaping
- **Secure Defaults**: Safe fallbacks for all user inputs and DOM operations

## 🔄 Migration from Monolithic Architecture

### Legacy vs. Refactored Structure
- **Before**: Single content.js file (2400+ lines) handling all functionality
- **After**: 8 focused modules with clear responsibilities and interfaces
- **Benefits**:
  - Better maintainability and debugging
  - Clearer separation of concerns
  - Easier testing and feature additions
  - Reduced cognitive load for developers
  - Improved error isolation

### Backward Compatibility
- All existing functionality preserved
- Same user interface and interactions
- Compatible with existing stored notes
- No changes to background.js or popup.js
- Same Chrome extension permissions

### Refactoring Improvements
- **Performance**: Element caching, debounced operations, batch processing
- **Code Quality**: Modern ES6+ patterns, comprehensive error handling
- **Documentation**: JSDoc comments, clear function signatures
- **Modularity**: Single responsibility principle, minimal dependencies
- **Testing**: Each module can be tested independently

## 🎯 Common Issues & Solutions

### Extension Development
- **Script injection fails**: Check tab validity and permissions
- **Storage not persisting**: Verify chrome.storage permissions
- **Context menu missing**: Check background.js service worker
- **Module not found errors**: Verify manifest.json script loading order
- **Notes not positioning correctly**: Check DOM selector generation and caching
- **Drag and drop not working**: Verify event listener setup and note-dragging module
- **URL monitoring issues**: Check URL change detection and callback registration
- **Memory leaks**: Monitor cleanup functions and event listener removal

### Backend Development
- **CORS issues**: Verify chrome-extension:// origins in FastAPI
- **Port conflicts**: Check localhost:8000 availability
- **Import errors**: Ensure virtual environment activation

*For detailed implementation see source files. For workflows see CLAUDE_CONTEXT.md. For session state see CLAUDE.md.*