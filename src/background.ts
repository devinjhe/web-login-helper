// Background service worker

// Track which tabs have a detected login page
const loginPageTabs = new Set<number>();

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;

  if (message.type === "LOGIN_PAGE_DETECTED") {
    console.log("[web-login-helper] Login page detected:", message.domain, "tab:", tabId);

    if (tabId !== undefined) {
      loginPageTabs.add(tabId);
      chrome.action.setBadgeText({ text: "!", tabId });
      chrome.action.setBadgeBackgroundColor({ color: "#f59e0b", tabId });
    }
    return;
  }

  if (message.type === "CLEAR_BADGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTabId = tabs[0]?.id;
      if (activeTabId !== undefined) {
        loginPageTabs.delete(activeTabId);
        chrome.action.setBadgeText({ text: "", tabId: activeTabId });
      }
    });
    return;
  }
});

// GET_LOGIN_PAGE_STATE must be in its own listener so it can return true (keeps channel open for async sendResponse)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_LOGIN_PAGE_STATE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTabId = tabs[0]?.id;
      const detected = activeTabId !== undefined && loginPageTabs.has(activeTabId);
      sendResponse({ detected });
    });
    return true; // keep channel open for async sendResponse
  }
});

// Clear badge when tab navigates away
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    loginPageTabs.delete(tabId);
    chrome.action.setBadgeText({ text: "", tabId });
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  loginPageTabs.delete(tabId);
});
