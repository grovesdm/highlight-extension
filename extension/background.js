// Define color states and their corresponding icon paths
const COLOR_STATES = {
    off: { color: '#fee086', icon: 'grey' },  // Yellow color when off
    yellow: { color: '#fee086', icon: 'yellow' },
    green: { color: '#cff09f', icon: 'green' },
    blue: { color: '#cee8f9', icon: 'blue' },
    red: { color: '#f4b3b1', icon: 'red' }
};

// Current state of the extension
let currentState = 'off';
let extensionState = {};

// Function to update the extension icon
function updateIcon(tabId) {
    const iconPath = `icons/icon_${COLOR_STATES[currentState].icon}`;
    chrome.action.setIcon({
        tabId: tabId,
        path: {
            "16": `${iconPath}_16.png`,
            "48": `${iconPath}_48.png`,
            "128": `${iconPath}_128.png`
        }
    });
}

// Function to cycle through color states
function cycleState() {
    const states = Object.keys(COLOR_STATES);
    const currentIndex = states.indexOf(currentState);
    currentState = states[(currentIndex + 1) % states.length];
}

// Function to set state directly
function setState(state) {
    if (COLOR_STATES.hasOwnProperty(state)) {
        currentState = state;
    }
}

// Function to toggle state
function toggleState(state) {
    currentState = currentState === state ? 'off' : state;
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    cycleState();
    updateIcon(tab.id);
    updateTabState(tab.id);
    updateContextMenu(tab.id);
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

// Function to update context menu based on extension state
function updateContextMenu(tabId) {
    const isActive = currentState !== 'off';
    if (isActive) {
        chrome.contextMenus.update("addHighlight", { visible: false });
    } else {
        chrome.contextMenus.update("addHighlight", {
            visible: true,
            title: "Add highlight to selection"
        });
    }
}

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        updateIcon(tabId);
        updateContextMenu(tabId);
    }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
    delete extensionState[tabId];
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getExtensionState") {
        sendResponse({
            isActive: currentState !== 'off',
            color: COLOR_STATES[currentState].color
        });
    } else if (request.action === "setStateFromShortcut") {
        toggleState(request.state);
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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "addHighlight") {
        chrome.tabs.sendMessage(tab.id, {
            action: 'addHighlight',
            color: COLOR_STATES.off.color  // Always yellow when off
        });
    } else if (info.menuItemId === "toggleHighlights") {
        chrome.tabs.sendMessage(tab.id, { action: 'toggleHighlights' });
    } else if (info.menuItemId === "clearPageHighlights") {
        chrome.tabs.sendMessage(tab.id, { action: 'clearPageHighlights' });
    } else if (info.menuItemId === "purgeAllHighlights") {
        if (confirm("Are you sure you want to purge all saved highlights? This action is irreversible.")) {
            chrome.storage.local.clear(() => {
                console.log('All highlights purged');
                chrome.tabs.sendMessage(tab.id, { action: 'purgeAllHighlights' });
            });
        }
    }
});

// Initialize context menus
chrome.runtime.onInstalled.addListener(() => {
    // Context menu for adding highlights (only appears when text is selected and extension is off)
    chrome.contextMenus.create({
        id: "addHighlight",
        title: "Add yellow highlight",
        contexts: ["selection"],
        documentUrlPatterns: ["<all_urls>"]
    });

    // Context menu for extension icon
    chrome.contextMenus.create({
        id: "toggleHighlights",
        title: "Toggle visibility (h)",
        contexts: ["action"]
    });
    chrome.contextMenus.create({
        id: "clearPageHighlights",
        title: "Clear page highlights",
        contexts: ["action"]
    });
    chrome.contextMenus.create({
        id: "purgeAllHighlights",
        title: "Purge all saved highlights",
        contexts: ["action"]
    });
});

