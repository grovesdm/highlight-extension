// Extension state
let isExtensionActive = false;
let currentColor = '#fee086'; // Default yellow
let areHighlightsVisible = true;

// Function to highlight selected text
function highlightSelection(color = currentColor) {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    span.classList.add('text-highlighter-span');
    span.style.backgroundColor = color;
    span.dataset.color = color;
    range.surroundContents(span);

    console.log('New highlight created:', span);

    saveHighlights();
}

// Save highlights in Chrome storage
function saveHighlights() {
    const highlights = Array.from(document.querySelectorAll('.text-highlighter-span')).map(span => {
        const { beforeText, afterText } = getSurroundingText(span.parentNode, span.textContent);
        return {
            text: span.textContent,
            color: span.dataset.color,
            beforeText,
            afterText,
            parentTag: span.parentNode.tagName.toLowerCase(),
            parentIndex: Array.from(span.parentNode.parentNode.children).indexOf(span.parentNode)
        };
    });

    chrome.storage.local.set({ [getStorageKey()]: highlights }, () => {
        console.log('Highlights saved:', highlights.length);
    });
}

// Load highlights from Chrome storage
function loadHighlights() {
    chrome.storage.local.get([getStorageKey()], function(result) {
        const highlights = result[getStorageKey()];
        if (highlights && highlights.length > 0) {
            console.log('Loaded highlights:', highlights.length);
            applyHighlights(highlights);
        } else {
            console.log('No highlights found in storage');
        }
    });
}

// Apply all highlights
function applyHighlights(highlights) {
    highlights.forEach(highlight => {
        const potentialParents = Array.from(document.getElementsByTagName(highlight.parentTag));
        for (const parent of potentialParents) {
            if (parent.textContent.includes(highlight.beforeText + highlight.text + highlight.afterText)) {
                const range = document.createRange();
                const textNode = Array.from(parent.childNodes).find(node =>
                    node.nodeType === Node.TEXT_NODE && node.textContent.includes(highlight.text)
                );

                if (textNode) {
                    const startOffset = textNode.textContent.indexOf(highlight.text);
                    range.setStart(textNode, startOffset);
                    range.setEnd(textNode, startOffset + highlight.text.length);

                    const span = document.createElement("span");
                    span.classList.add('text-highlighter-span');
                    span.style.backgroundColor = highlight.color;
                    span.dataset.color = highlight.color;

                    try {
                        range.surroundContents(span);
                        console.log('Highlight applied:', span);
                    } catch (error) {
                        console.error('Error applying highlight:', error);
                    }
                    break;
                }
            }
        }
    });

    updateHighlightsVisibility();
}

// Get a unique selector for an element
function getUniqueSelector(element) {
    if (element.id) return '#' + element.id;
    if (element === document.body) return 'body';
    const parent = element.parentNode;
    const siblings = parent.children;
    let index = 0;
    for (let i = 0; i < siblings.length; i++) {
        if (siblings[i] === element) break;
        if (siblings[i].tagName === element.tagName) index++;
    }
    return getUniqueSelector(parent) + ' > ' + element.tagName.toLowerCase() + ':nth-of-type(' + (index + 1) + ')';
}

// Get a unique storage key for the current page
function getStorageKey() {
    return 'highlights_' + window.location.hostname + window.location.pathname;
}

// Update highlights visibility
function updateHighlightsVisibility() {
    document.querySelectorAll('.text-highlighter-span').forEach(span => {
        span.style.backgroundColor = areHighlightsVisible ? span.dataset.color : 'transparent';
    });
}

// Function to delete a highlight
function deleteHighlight(element) {
    if (element.classList.contains('text-highlighter-span')) {
        const parent = element.parentNode;
        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
        saveHighlights();
    }
}

// Function to update cursor style
function updateCursorStyle(event) {
    const isHighlight = event.target.classList.contains('text-highlighter-span');
    document.body.style.cursor = isHighlight ? 'default' : 'auto';
}

// Event listeners for cursor style updates
document.addEventListener('mouseover', updateCursorStyle);
document.addEventListener('mouseout', () => document.body.style.cursor = 'auto');

// Event listener for mouseup to highlight text when extension is active
document.addEventListener('mouseup', (event) => {
    if (isExtensionActive && !event.target.classList.contains('text-highlighter-span')) {
        highlightSelection();
    }
});

// Event listener for Ctrl+click to delete highlight
document.addEventListener('click', (event) => {
    if (event.ctrlKey && event.target.classList.contains('text-highlighter-span')) {
        deleteHighlight(event.target);
    }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateExtensionState') {
        isExtensionActive = request.isActive;
        currentColor = request.color;
        console.log('Extension state updated:', isExtensionActive, currentColor);
    } else if (request.action === 'addHighlight') {
        highlightSelection(request.color);
    } else if (request.action === 'toggleHighlights') {
        areHighlightsVisible = !areHighlightsVisible;
        updateHighlightsVisibility();
    } else if (request.action === 'clearPageHighlights') {
        clearPageHighlights();
    } else if (request.action === 'purgeAllHighlights') {
        purgeAllHighlights();
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getExtensionState") {
        sendResponse({
            isActive: currentState !== 'off',
            color: COLOR_STATES[currentState].color
        });
    } else if (request.action === "setStateFromShortcut") {
        setState(request.state);
        updateIcon(sender.tab.id);
        updateTabState(sender.tab.id);
        updateContextMenu(sender.tab.id);
    } else if (request.action === "turnOff") {
        setState('off');
        updateIcon(sender.tab.id);
        updateTabState(sender.tab.id);
        updateContextMenu(sender.tab.id);
    }
});

// Event listener for keyboard shortcuts
document.addEventListener('keydown', (event) => {
    // Check if the active element is an input field, textarea, or has contenteditable attribute
    const isEditableElement =
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable;

    if (isEditableElement) {
        return; // Don't trigger shortcuts when typing in editable fields
    }

    switch (event.key.toLowerCase()) {
        case 'y':
            chrome.runtime.sendMessage({ action: "setStateFromShortcut", state: "yellow" });
            break;
        case 'r':
            chrome.runtime.sendMessage({ action: "setStateFromShortcut", state: "red" });
            break;
        case 'g':
            chrome.runtime.sendMessage({ action: "setStateFromShortcut", state: "green" });
            break;
        case 'b':
            chrome.runtime.sendMessage({ action: "setStateFromShortcut", state: "blue" });
            break;
        case 'h':
            areHighlightsVisible = !areHighlightsVisible;
            updateHighlightsVisibility();
            break;
        case 'escape':
            chrome.runtime.sendMessage({ action: "turnOff" });
            break;
    }
});

// Function to update tab state and send message to content script
function updateTabState(tabId) {
    const isActive = currentState !== 'off';
    extensionState[tabId] = isActive;
    chrome.tabs.sendMessage(tabId, {
        action: 'updateExtensionState',
        isActive: isActive,
        color: COLOR_STATES[currentState].color
    });
    console.log('Extension state updated for tab', tabId, ':', currentState);
}

// Function to clear page highlights
function clearPageHighlights() {
    document.querySelectorAll('.text-highlighter-span').forEach(span => {
        const parent = span.parentNode;
        while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
    });
    chrome.storage.local.remove(getStorageKey(), () => {
        console.log('Page highlights cleared');
    });
}

// Function to purge all highlights
function purgeAllHighlights() {
    document.querySelectorAll('.text-highlighter-span').forEach(span => {
        const parent = span.parentNode;
        while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
    });
}

// Custom context menu for "Delete highlight"
let customContextMenu = null;

// Add "Delete highlight" to browser's context menu for highlights
document.addEventListener('contextmenu', function(e) {
    if (customContextMenu) {
        customContextMenu.remove();
        customContextMenu = null;
    }

    if (e.target.classList.contains('text-highlighter-span')) {
        e.preventDefault();
        customContextMenu = document.createElement('div');
        customContextMenu.className = 'custom-context-menu';
        customContextMenu.innerHTML = '<div class="menu-item">Delete (shortcut: ctrl + click highlight)</div>';
        customContextMenu.style.position = 'fixed';
        customContextMenu.style.left = (e.clientX + 10) + 'px'; // Offset by 10px to the right
        customContextMenu.style.top = (e.clientY - 35) + 'px'; // Offset by 10px to the top
        customContextMenu.style.backgroundColor = 'white';
        customContextMenu.style.border = '1px solid black';
        customContextMenu.style.padding = '5px';
        customContextMenu.style.cursor = 'pointer';
        customContextMenu.style.zIndex = '9999';

        document.body.appendChild(customContextMenu);

        customContextMenu.querySelector('.menu-item').addEventListener('click', function() {
            deleteHighlight(e.target);
            customContextMenu.remove();
            customContextMenu = null;
        });

        document.addEventListener('click', function removeMenu() {
            if (customContextMenu) {
                customContextMenu.remove();
                customContextMenu = null;
            }
            document.removeEventListener('click', removeMenu);
        });
    }
});

// Function to get surrounding text
function getSurroundingText(node, text, windowSize = 50) {
    const fullText = node.textContent;
    const startIndex = fullText.indexOf(text);
    const endIndex = startIndex + text.length;
    const beforeText = fullText.substring(Math.max(0, startIndex - windowSize), startIndex);
    const afterText = fullText.substring(endIndex, Math.min(fullText.length, endIndex + windowSize));
    return { beforeText, afterText };
}

// Initialize extension state
chrome.runtime.sendMessage({ action: "getExtensionState" }, function(response) {
    isExtensionActive = response.isActive;
    currentColor = response.color;
    console.log('Initial extension state:', isExtensionActive, currentColor);
    loadHighlights();
});