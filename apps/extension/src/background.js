// MV3 service worker: opens the options page on first install so the user
// can configure the API base URL before saving anything.

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});
