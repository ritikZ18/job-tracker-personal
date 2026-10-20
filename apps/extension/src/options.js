import { getSettings, saveSettings } from "./api.js";

const els = {
  apiBase: document.getElementById("apiBase"),
  apiToken: document.getElementById("apiToken"),
  save: document.getElementById("save"),
  message: document.getElementById("message"),
};

async function load() {
  const settings = await getSettings();
  els.apiBase.value = settings.apiBase;
  els.apiToken.value = settings.apiToken;
}

async function onSave() {
  els.save.disabled = true;
  try {
    await saveSettings({
      apiBase: els.apiBase.value.trim() || "http://localhost:3001",
      apiToken: els.apiToken.value.trim(),
    });
    els.message.textContent = "Saved.";
    els.message.className = "success";
  } catch (err) {
    els.message.textContent = err.message || "Save failed";
    els.message.className = "error";
  } finally {
    els.save.disabled = false;
  }
}

els.save.addEventListener("click", onSave);
load();
