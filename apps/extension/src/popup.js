// Popup controller. UI only — delegates extraction to extract.js (executed in
// the page context) and persistence to api.js.

import { extractJobData } from "./extract.js";
import { saveApplication } from "./api.js";

const els = {
  preview: document.getElementById("preview"),
  title: document.getElementById("p-title"),
  company: document.getElementById("p-company"),
  location: document.getElementById("p-location"),
  message: document.getElementById("message"),
  save: document.getElementById("save"),
  options: document.getElementById("open-options"),
};

let extracted = null;

function setMessage(text, kind) {
  els.message.textContent = text;
  els.message.className = kind || "";
}

async function loadActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setMessage("No active tab found.", "error");
    return;
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobData,
    });

    if (!result?.result) {
      setMessage("Could not read this page.", "error");
      return;
    }

    extracted = result.result;
    els.title.textContent = extracted.title || "(unknown)";
    els.company.textContent = extracted.company || "(unknown)";
    els.location.textContent = extracted.location || "—";
    els.preview.hidden = false;
    els.save.disabled = false;
    setMessage("Ready to save.", "");
  } catch (err) {
    setMessage(`Cannot inject into this page: ${err.message}`, "error");
  }
}

async function onSave() {
  if (!extracted) return;
  els.save.disabled = true;
  setMessage("Saving…", "");

  try {
    await saveApplication(extracted);
    setMessage("Saved! ✓", "success");
    setTimeout(() => window.close(), 800);
  } catch (err) {
    setMessage(err.message || "Save failed", "error");
    els.save.disabled = false;
  }
}

els.save.addEventListener("click", onSave);
els.options.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

loadActiveTab();
