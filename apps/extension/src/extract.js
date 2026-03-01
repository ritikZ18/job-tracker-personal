// Pure DOM extraction helpers — runs in the page context via chrome.scripting.executeScript.
// No dependencies; this file is injected as a function body.

export function extractJobData() {
  // 1) JSON-LD JobPosting (preferred, structured)
  const blocks = document.querySelectorAll(
    'script[type="application/ld+json"]',
  );
  for (const block of blocks) {
    try {
      const raw = JSON.parse(block.textContent || "");
      const items = Array.isArray(raw) ? raw : [raw];
      for (const item of items) {
        if (item["@type"] === "JobPosting" || item.title || item.jobTitle) {
          const loc = item.jobLocation;
          return {
            title: item.title || item.jobTitle || item.name || document.title,
            company:
              item.hiringOrganization?.name ||
              item.employer?.name ||
              item.company ||
              window.location.hostname,
            location:
              typeof loc === "string"
                ? loc
                : loc?.address?.addressLocality || loc?.name || null,
            description: item.description || null,
            url: window.location.href,
            source: "EXTENSION",
          };
        }
      }
    } catch {
      /* JSON-LD parse failure: continue */
    }
  }

  // 2) OpenGraph + meta fallbacks
  const og = (prop) =>
    document
      .querySelector(`meta[property="og:${prop}"]`)
      ?.getAttribute("content") || null;

  return {
    title:
      og("title") || document.title.split("|")[0]?.trim() || document.title,
    company: og("site_name") || window.location.hostname,
    location: null,
    description:
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content") || null,
    url: window.location.href,
    source: "EXTENSION",
  };
}
