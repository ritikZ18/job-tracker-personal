// Tiny API client — only knows how to read settings from chrome.storage and
// POST to the CareerCrawl API. Anything UI-related stays out of here.

const STORAGE_KEYS = ["apiBase", "apiToken"];
const DEFAULT_API_BASE = "http://localhost:3001";

export async function getSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS);
  return {
    apiBase: stored.apiBase || DEFAULT_API_BASE,
    apiToken: stored.apiToken || "",
  };
}

export async function saveSettings({ apiBase, apiToken }) {
  await chrome.storage.local.set({ apiBase, apiToken });
}

export async function saveApplication(payload) {
  const { apiBase, apiToken } = await getSettings();
  const headers = { "Content-Type": "application/json" };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

  const res = await fetch(`${apiBase}/applications`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      company: payload.company,
      jobTitle: payload.title,
      jobUrl: payload.url,
      jobDescription: payload.description || undefined,
      status: "SAVED",
      source: payload.source || "EXTENSION",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
