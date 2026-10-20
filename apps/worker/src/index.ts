import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { chromium } from "playwright";
import { extractBranding } from "./lib/branding.js";
import { extractWithLLMFallback } from "./lib/llm.js";
import { startScheduler } from "./scheduler.js";
import { notifyJobDiscovered } from "./notifications.js";
import {
  ExtractedData,
  DiscoveredJob,
  isJunkListingTitle,
  scoreJobCandidateLink,
  isValidJobPostingPage,
  computeQualityScore,
  detectRemote,
  detectSeniority,
  detectEmploymentType,
  generateJobSlug,
} from "./lib/parser.js";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  json,
  varchar,
  boolean,
  integer,
  numeric,
} from "drizzle-orm/pg-core";

// ============================================================
// INLINE SCHEMA (avoids cross-package import issues)
// ============================================================

const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);
const jobAnalysisStatusEnum = pgEnum("job_analysis_status", [
  "PENDING",
  "RUNNING",
  "DONE",
  "FAILED",
]);
const crawlStatusEnum = pgEnum("crawl_status", [
  "QUEUED",
  "RUNNING",
  "SUCCESS",
  "FAILED",
]);
const jobStatusEnum = pgEnum("job_status", ["OPEN", "CLOSED"]);
const sourcePlatformEnum = pgEnum("source_platform", [
  "GREENHOUSE",
  "LEVER",
  "WORKDAY",
  "ICIMS",
  "CUSTOM",
  "UNKNOWN",
]);
const changeTypeEnum = pgEnum("change_type", ["NEW", "UPDATED", "CLOSED"]);
const discoverySourceEnum = pgEnum("discovery_source", ["DIRECT", "WEB"]);
const parseMethodEnum = pgEnum("parse_method", [
  "ATS_API",
  "HTML",
  "LLM_FALLBACK",
]);
const eventTypeEnum = pgEnum("event_type", [
  "JOB_DISCOVERED",
  "JOB_UPDATED",
  "JOB_CLOSED",
  "CRAWL_STARTED",
  "CRAWL_COMPLETED",
  "CRAWL_FAILED",
  "COMPANY_ADDED",
  "JOB_CLICKED",
]);

const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  supabaseUid: varchar("supabase_uid", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull().default("USER"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

const jobAnalyses = pgTable("job_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobUrl: text("job_url").notNull(),
  status: jobAnalysisStatusEnum("status").notNull().default("PENDING"),
  result: json("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  careerUrl: text("career_url").notNull(),
  sourcePlatform: sourcePlatformEnum("source_platform")
    .notNull()
    .default("UNKNOWN"),
  discoverySource: discoverySourceEnum("discovery_source")
    .notNull()
    .default("DIRECT"),
  logoUrl: text("logo_url"),
  heroImageUrl: text("hero_image_url"),
  rootDomain: varchar("root_domain", { length: 255 }),
  crawlStatus: crawlStatusEnum("crawl_status"),
  lastCrawlAt: timestamp("last_crawl_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  jobTitle: varchar("job_title", { length: 500 }).notNull(),
  jobSlug: varchar("job_slug", { length: 500 }).notNull().unique(),
  canonicalJobUrl: text("canonical_job_url").notNull(),
  jobLocation: varchar("job_location", { length: 500 }),
  jobTeam: varchar("job_team", { length: 255 }),
  employmentType: varchar("employment_type", { length: 100 }),
  postedDate: timestamp("posted_date", { withTimezone: true }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: jobStatusEnum("status").notNull().default("OPEN"),
  descriptionHtml: text("description_html"),
  descriptionText: text("description_text"),
  applyUrl: text("apply_url"),
  sourcePlatform: sourcePlatformEnum("source_platform")
    .notNull()
    .default("UNKNOWN"),
  salaryRange: varchar("salary_range", { length: 255 }),
  seniority: varchar("seniority", { length: 100 }),
  isRemote: boolean("is_remote").default(false),
  tags: json("tags").$type<string[]>().default([]),
  qualityScore: numeric("quality_score", { precision: 3, scale: 2 }),
  parseMethod: parseMethodEnum("parse_method").notNull().default("HTML"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

const jobSnapshots = pgTable("job_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  snapshotData: json("snapshot_data").notNull().default({}),
  changeType: changeTypeEnum("change_type").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

const crawlRuns = pgTable("crawl_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  status: crawlStatusEnum("status").notNull().default("QUEUED"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  pagesFetched: integer("pages_fetched").notNull().default(0),
  jobsDiscovered: integer("jobs_discovered").notNull().default(0),
  jobsUpdated: integer("jobs_updated").notNull().default(0),
  jobsClosed: integer("jobs_closed").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  durationMs: integer("duration_ms"),
  logs: json("logs").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

const domainConfigs = pgTable("domain_configs", {
  domain: varchar("domain", { length: 255 }).primaryKey(),
  jobLinkSelector: text("job_link_selector"),
  nextPageSelector: text("next_page_selector"),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: eventTypeEnum("event_type").notNull(),
  entityId: varchar("entity_id", { length: 255 }),
  entityType: varchar("entity_type", { length: 100 }),
  metadata: json("metadata").default({}),
  correlationId: varchar("correlation_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// DB + REDIS SETUP
// ============================================================

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/job_tracking",
});
const db = drizzle(pool);

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Publisher for live crawl logs
const publisher = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Helpers and Interfaces now imported from ./lib/parser.js
// ============================================================

/** Publish a live log line to Redis channel + append to crawl run logs array */
async function publishLog(crawlRunId: string, message: string) {
  const logEntry = `[${new Date().toISOString()}] ${message}`;
  console.log(`[crawl:${crawlRunId}] ${message}`);

  // Publish to SSE subscribers
  publisher.publish(
    `crawl:${crawlRunId}`,
    JSON.stringify({ type: "log", message: logEntry, timestamp: Date.now() }),
  );
}

// ============================================================
// INTERFACES
// ============================================================

interface AnalyzeJobData {
  jobAnalysisId: string;
  jobUrl: string;
  userId: string;
  companyOverride?: string;
}

// Interfaces now imported from ./lib/parser.js

interface CrawlJobData {
  companyId: string;
  careerUrl: string;
  crawlRunId: string;
  platform: string;
  preferences?: {
    maxAgeDays?: number;
    categories?: string[];
  };
}

// Interfaces now imported from ./lib/parser.js

// ============================================================
// EXTRACTION FUNCTIONS (kept from original)
// ============================================================

async function extractWithFetch(url: string): Promise<ExtractedData | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

async function extractWithPlaywright(
  url: string,
): Promise<ExtractedData | null> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "America/New_York",
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    // Scroll to trigger lazy loading
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    const html = await page.content();
    return parseHtml(html, url);
  } catch (error) {
    console.error("Playwright extraction error:", error);
    return null;
  } finally {
    await browser.close();
  }
}

function parseHtml(html: string, url?: string): ExtractedData {
  const result: ExtractedData = {};

  // Try JSON-LD first
  const jsonLdBlocks = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (jsonLdBlocks) {
    for (const block of jsonLdBlocks) {
      try {
        const content = block.match(/>([\s\S]*?)</)?.[1];
        if (!content) continue;
        const jsonLd = JSON.parse(content);

        // Handle both single object and array
        const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
        for (const item of items) {
          if (item["@type"] === "JobPosting" || item.title || item.jobTitle) {
            result.title =
              result.title || item.title || item.jobTitle || item.name;
            result.company =
              result.company ||
              item.hiringOrganization?.name ||
              item.company ||
              item.employer?.name;
            result.description = result.description || item.description;
            result.jobId = result.jobId || item.identifier?.value || item.id;
            if (item.jobLocation) {
              const loc = item.jobLocation;
              result.location =
                result.location ||
                (typeof loc === "string"
                  ? loc
                  : loc.address?.addressLocality || loc.name);
            }
          }
        }
      } catch {
        /* JSON-LD parse failed */
      }
    }
  }

  // Try OpenGraph
  if (!result.title) {
    const ogTitle = html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    );
    if (ogTitle) result.title = ogTitle[1];
  }
  if (!result.company) {
    const ogSite = html.match(
      /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i,
    );
    if (ogSite) result.company = ogSite[1];
  }
  if (!result.company) {
    const appName = html.match(
      /<meta[^>]*name=["']application-name["'][^>]*content=["']([^"']+)["']/i,
    );
    if (appName) result.company = appName[1];
  }

  // Title fallbacks
  if (!result.title) {
    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1) result.title = h1[1]?.trim();
  }
  if (!result.title) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag) result.title = titleTag[1]?.trim().split("|")[0]?.trim();
  }

  // Description fallbacks
  if (!result.description) {
    const descMeta = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
    );
    if (descMeta) result.description = descMeta[1];
  }

  // Location from title or content
  if (!result.location) {
    const locationMatch = html.match(
      /class=["'][^"']*location[^"']*["'][^>]*>([^<]+)</i,
    );
    if (locationMatch) result.location = locationMatch[1]?.trim();
  }

  return result;
}

// ============================================================
// CAREER PAGE DISCOVERY (Phase 1)
// ============================================================

async function discoverJobLinks(
  careerUrl: string,
  platform: string,
  crawlRunId: string,
): Promise<DiscoveredJob[]> {
  await publishLog(
    crawlRunId,
    `[DISCOVERY] Starting career page crawl: ${careerUrl}`,
  );
  await publishLog(crawlRunId, `[DISCOVERY] Detected platform: ${platform}`);

  // Try platform-specific API first
  if (platform === "GREENHOUSE") {
    const apiJobs = await discoverGreenhouseJobs(careerUrl, crawlRunId);
    if (apiJobs.length > 0) return apiJobs;
  }
  if (platform === "LEVER") {
    const apiJobs = await discoverLeverJobs(careerUrl, crawlRunId);
    if (apiJobs.length > 0) return apiJobs;
  }

  // Fallback: Playwright full-page scrape
  return await discoverWithPlaywright(careerUrl, crawlRunId);
}

async function discoverGreenhouseJobs(
  careerUrl: string,
  crawlRunId: string,
): Promise<DiscoveredJob[]> {
  try {
    // Extract board token from URL like boards.greenhouse.io/companyname
    const match = careerUrl.match(/greenhouse\.io\/(\w+)/);
    if (!match) return [];
    const boardToken = match[1];

    await publishLog(
      crawlRunId,
      `[GREENHOUSE] Fetching API: boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`,
    );

    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as any;

    const discovered: DiscoveredJob[] = (data.jobs || []).map((job: any) => ({
      title: job.title,
      url:
        job.absolute_url ||
        `https://boards.greenhouse.io/${boardToken}/jobs/${job.id}`,
      location: job.location?.name,
      team: job.departments?.[0]?.name,
      jobId: String(job.id),
      postedDate: job.updated_at || job.created_at,
    }));

    await publishLog(
      crawlRunId,
      `[GREENHOUSE] Found ${discovered.length} jobs via API`,
    );
    return discovered;
  } catch (error) {
    await publishLog(
      crawlRunId,
      `[GREENHOUSE] API failed, falling back to scrape`,
    );
    return [];
  }
}

async function discoverLeverJobs(
  careerUrl: string,
  crawlRunId: string,
): Promise<DiscoveredJob[]> {
  try {
    // Extract company from URL like jobs.lever.co/companyname
    const match = careerUrl.match(/lever\.co\/([^\/\?]+)/);
    if (!match) return [];
    const company = match[1];

    await publishLog(
      crawlRunId,
      `[LEVER] Fetching API: api.lever.co/v0/postings/${company}`,
    );

    const res = await fetch(
      `https://api.lever.co/v0/postings/${company}?limit=100`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as any[];

    const discovered: DiscoveredJob[] = data.map((job: any) => ({
      title: job.text,
      url: job.hostedUrl || job.applyUrl,
      location: job.categories?.location,
      team: job.categories?.team || job.categories?.department,
      jobId: job.id,
      postedDate: job.createdAt
        ? new Date(job.createdAt).toISOString()
        : undefined,
    }));

    await publishLog(
      crawlRunId,
      `[LEVER] Found ${discovered.length} jobs via API`,
    );
    return discovered;
  } catch (error) {
    await publishLog(crawlRunId, `[LEVER] API failed, falling back to scrape`);
    return [];
  }
}

async function discoverWithPlaywright(
  careerUrl: string,
  crawlRunId: string,
): Promise<DiscoveredJob[]> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();

    // ✅ Network sniffing for Workday / ATS JSON responses
    const seenJobs = new Map<string, DiscoveredJob>();
    page.on("response", async (resp) => {
      try {
        const url = resp.url();
        const ct = resp.headers()["content-type"] || "";
        if (!ct.includes("application/json")) return;

        // Workday often returns jobs via /fs/searchPagination or /wday/cxs/
        if (
          !/searchPagination|wday\/cxs|myworkdayjobs|workdayjobs|icims/i.test(
            url,
          )
        )
          return;

        const json = await resp.json().catch(() => null);
        if (!json) return;

        // Best-effort extraction (structure varies)
        const candidates =
          json?.jobPostings ||
          json?.jobRequisitions ||
          json?.items ||
          json?.data?.jobs ||
          [];

        for (const j of candidates) {
          const title = j?.title || j?.jobTitle || j?.name;
          const link =
            j?.externalPath || j?.url || j?.applyUrl || j?.jobPostingUrl;
          if (!title || !link) continue;

          const abs = new URL(link, careerUrl).toString();
          if (!seenJobs.has(abs)) {
            seenJobs.set(abs, {
              title,
              url: abs,
              location: j?.locationsText || j?.location?.name || j?.location,
              team: j?.department?.name || j?.department || j?.team,
              jobId: j?.jobId || (j?.id ? String(j.id) : undefined),
              postedDate: j?.postedOn || j?.postedDate,
            });
          }
        }
      } catch {
        /* ignore */
      }
    });

    await publishLog(crawlRunId, `[PLAYWRIGHT] Loading page: ${careerUrl}`);
    await page.goto(careerUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    // If network sniffing found jobs, return them early (ATS/API priority)
    if (seenJobs.size > 0) {
      await publishLog(
        crawlRunId,
        `[NET] Found ${seenJobs.size} jobs via JSON network sniffing`,
      );
      return [...seenJobs.values()];
    }

    // Scroll to load lazy content
    await publishLog(
      crawlRunId,
      `[PLAYWRIGHT] Scrolling page to load all content...`,
    );
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 150);
      });
    });
    await page.waitForTimeout(2000);

    // Try to find "Load More" or "Show All" buttons and click them
    const loadMoreSelectors = [
      'button:has-text("Load More")',
      'button:has-text("Show All")',
      'button:has-text("View All")',
      'a:has-text("View all")',
      'a:has-text("See all")',
    ];
    for (const sel of loadMoreSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible()) {
          await publishLog(
            crawlRunId,
            `[PLAYWRIGHT] Clicking "Load More" button...`,
          );
          await btn.click();
          await page.waitForTimeout(2000);
        }
      } catch {
        /* not found, continue */
      }
    }

    // Extract job links from the page
    const discovered = await page.evaluate((baseUrl: string) => {
      // NOTE: this body runs in the BROWSER context — it cannot reference Node-side imports.
      // Anything we need (regexes, helpers) must be defined inline.
      const JUNK_TITLE_RE =
        /(talent\s*network|join\s*talent|register|sign\s*up|login|privacy|cookie|terms|about|culture|benefits|events|newsletter|working\s*at|cookies|preferences|dashboard|my\s*applications|help|faq|legal)/i;

      const jobLinks: {
        title: string;
        url: string;
        location?: string;
        team?: string;
      }[] = [];
      const seen = new Set<string>();

      // Common job link patterns
      const links = document.querySelectorAll("a[href]");
      for (const link of links) {
        const href = (link as HTMLAnchorElement).href;
        const text = (link as HTMLElement).innerText?.trim();

        // Skip non-job links
        if (!text || text.length < 3 || text.length > 200) continue;
        if (
          href.includes("#") &&
          !href.includes("/jobs/") &&
          !href.includes("/positions/")
        )
          continue;
        if (href.match(/\.(pdf|png|jpg|css|js)$/i)) continue;

        // Strict filter for junk links/navigation
        const junkRegex =
          /^(faq|about|privacy|terms|cookie|legal|help|contact|support|press|blog|learn more|working at|benefits|perks|values|diversity|equity|inclusion|investor|news|events|social|apply now|view job|find out more)$/i;
        if (junkRegex.test(text)) continue;

        if (seen.has(href)) continue;
        if (JUNK_TITLE_RE.test(text)) continue;

        // Heuristics: looks like a job link
        let path = "";
        try {
          path = new URL(href).pathname.toLowerCase();
        } catch {
          /* ignore malformed */
        }

        const isJobLink =
          path.includes("/jobs/") ||
          path.includes("/job/") ||
          path.includes("/positions/") ||
          path.includes("/careers/") ||
          path.includes("/opening/") ||
          path.includes("/apply/") ||
          href.includes("greenhouse.io") ||
          href.includes("lever.co") ||
          href.includes("myworkdayjobs") ||
          // Parent element has job-related classes
          link.closest('[class*="job"]') !== null ||
          link.closest('[class*="position"]') !== null ||
          link.closest('[class*="opening"]') !== null ||
          link.closest('[class*="career"]') !== null;

        if (
          isJobLink &&
          text &&
          !text.match(/^(home|about|blog|contact|login|sign)/i)
        ) {
          seen.add(href);

          // Try to extract location from sibling/parent context
          const parent = link.closest("li, tr, div, article");
          let location: string | undefined;
          let team: string | undefined;

          if (parent) {
            const locEl = parent.querySelector(
              '[class*="location"], [class*="city"]',
            );
            if (locEl) location = (locEl as HTMLElement).innerText?.trim();
            const teamEl = parent.querySelector(
              '[class*="team"], [class*="department"], [class*="category"]',
            );
            if (teamEl) team = (teamEl as HTMLElement).innerText?.trim();
          }

          jobLinks.push({
            title: text.split("\n")[0]!.trim(),
            url: href,
            location,
            team,
          });
        }
      }

      return jobLinks;
    }, careerUrl);

    await publishLog(
      crawlRunId,
      `[PLAYWRIGHT] Found ${discovered.length} potential job links`,
    );
    return discovered;
  } catch (error) {
    await publishLog(
      crawlRunId,
      `[PLAYWRIGHT] Error: ${error instanceof Error ? error.message : "Unknown"}`,
    );
    return [];
  } finally {
    await browser.close();
  }
}

// ============================================================
// JOB DETAIL EXTRACTION (Phase 2)
// ============================================================

async function extractJobDetail(
  url: string,
  crawlRunId: string,
): Promise<ExtractedData | null> {
  await publishLog(crawlRunId, `[DETAIL] Fetching: ${url}`);

  // Try simple fetch first
  let result = await extractWithFetch(url);

  // Fallback to Playwright if needed
  if (!result || (!result.title && !result.company)) {
    await publishLog(
      crawlRunId,
      `[DETAIL] Fetch incomplete, trying Playwright...`,
    );
    result = await extractWithPlaywright(url);
  }

  return result;
}

// ============================================================
// CAREER PAGE CRAWL WORKER (Phase 1 + 2 combined)
// ============================================================

const crawlWorker = new Worker<CrawlJobData>(
  "crawl-career-page",
  async (job: Job<CrawlJobData>) => {
    const { companyId, careerUrl, crawlRunId, platform, preferences } =
      job.data;
    const startTime = Date.now();

    // Update status to RUNNING
    await db
      .update(crawlRuns)
      .set({ status: "RUNNING", startedAt: new Date() })
      .where(eq(crawlRuns.id, crawlRunId));
    await db
      .update(companies)
      .set({ crawlStatus: "RUNNING", updatedAt: new Date() })
      .where(eq(companies.id, companyId));

    await publishLog(crawlRunId, `Starting crawl for ${careerUrl}`);
    if (preferences?.maxAgeDays) {
      await publishLog(
        crawlRunId,
        `[fetch] Age filter: last ${preferences.maxAgeDays} days`,
      );
    } else {
      await publishLog(crawlRunId, `[fetch] Age filter: none`);
    }

    // Emit event
    await db.insert(events).values({
      eventType: "CRAWL_STARTED",
      entityId: crawlRunId,
      entityType: "crawl_run",
      correlationId: crawlRunId,
      metadata: { companyId, careerUrl, platform, preferences },
    });

    let jobsDiscovered = 0;
    let jobsUpdated = 0;
    let errorCount = 0;
    let pagesFetched = 1;

    try {
      // Get company name + userId (userId needed for alert fan-out)
      const [company] = await db
        .select({ name: companies.name, userId: companies.userId })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
      const companyName = company?.name || "unknown";
      const companyUserId = company?.userId || null;

      // PHASE 0: Branding Extraction (Best effort)
      await publishLog(
        crawlRunId,
        `[BRANDING] Extracting company logo and branding...`,
      );
      const branding = await extractBranding(careerUrl);
      if (branding.logoUrl || branding.heroImageUrl) {
        await db
          .update(companies)
          .set({
            logoUrl: branding.logoUrl,
            heroImageUrl: branding.heroImageUrl,
            rootDomain: branding.rootDomain,
            updatedAt: new Date(),
          })
          .where(eq(companies.id, companyId));
        await publishLog(
          crawlRunId,
          `[BRANDING] Found logo: ${branding.logoUrl}`,
        );
      }

      // PHASE 1: Discover job links
      await publishLog(crawlRunId, `[crawl] Status → crawling`);
      const discovered = await discoverJobLinks(
        careerUrl,
        platform,
        crawlRunId,
      );

      if (discovered.length === 0) {
        await publishLog(crawlRunId, `[done] No jobs found.`);
      } else {
        await publishLog(
          crawlRunId,
          `[parse] ${discovered.length} job listings found`,
        );
      }

      // PHASE 2: Process each discovered job (batch-save as we go)
      for (let i = 0; i < discovered.length; i++) {
        const disc = discovered[i]!;
        try {
          // Reject obvious junk from discovery
          if (
            isJunkListingTitle(disc.title) ||
            scoreJobCandidateLink(disc.url, disc.title) < 1
          ) {
            await publishLog(
              crawlRunId,
              `[SKIP] Rejected junk listing: "${disc.title}"`,
            );
            continue;
          }

          const jobSlug = generateJobSlug(companyName, disc.jobId, disc.url);

          // Check if this job already exists
          const [existing] = await db
            .select()
            .from(jobs)
            .where(eq(jobs.jobSlug, jobSlug))
            .limit(1);

          let detail: ExtractedData | null = null;
          let quality = 0;
          let parseMethod: "ATS_API" | "HTML" | "LLM_FALLBACK" =
            platform === "CUSTOM" ? "HTML" : "ATS_API";

          if (existing) {
            // UPDATE: mark as still seen
            // We might want to re-parse if existing quality is low or missing description
            const needsDetailUpdate =
              !existing.descriptionText ||
              (existing.qualityScore && Number(existing.qualityScore) < 0.5);

            if (needsDetailUpdate) {
              detail = await extractJobDetail(disc.url, crawlRunId);
            }

            const changed =
              existing.jobTitle !== disc.title ||
              (disc.location && existing.jobLocation !== disc.location);
            await db
              .update(jobs)
              .set({
                lastSeenAt: new Date(),
                status: "OPEN",
                ...(disc.location && { jobLocation: disc.location }),
                ...(disc.team && { jobTeam: disc.team }),
                ...(detail?.description && {
                  descriptionHtml: detail.description,
                  descriptionText: detail.description,
                }),
                updatedAt: new Date(),
              })
              .where(eq(jobs.id, existing.id));

            if (changed) {
              await db.insert(jobSnapshots).values({
                jobId: existing.id,
                snapshotData: { title: disc.title, location: disc.location },
                changeType: "UPDATED",
              });
              jobsUpdated++;
              await publishLog(
                crawlRunId,
                `[db] updated "${disc.title}" @ ${disc.location || "N/A"}`,
              );
            }
          } else {
            // NEW JOB: Extract full details
            detail = await extractJobDetail(disc.url, crawlRunId);

            // VALIDATION GATE
            if (!isValidJobPostingPage(detail)) {
              await publishLog(
                crawlRunId,
                `[SKIP] Not a valid job posting page: ${disc.url}`,
              );
              continue;
            }

            quality = computeQualityScore(disc, detail);

            // LLM FALLBACK TRIGGER
            if (quality < 0.6) {
              await publishLog(
                crawlRunId,
                `[LLM] Low quality (${quality.toFixed(2)}). Triggering fallback...`,
              );
              const llm = await extractWithLLMFallback(disc.url);
              if (llm?.title) {
                detail = {
                  title: llm.title,
                  company: llm.company ?? detail?.company,
                  location: llm.location ?? detail?.location,
                  jobId: detail?.jobId,
                  description: llm.description_text ?? detail?.description,
                };
                quality = Math.max(quality, 0.85);
                parseMethod = "LLM_FALLBACK";
                await publishLog(
                  crawlRunId,
                  `[LLM] Resolved with AI: ${llm.title}`,
                );
              }
            }

            const [newJob] = await db
              .insert(jobs)
              .values({
                companyId,
                jobTitle: detail?.title || disc.title,
                jobSlug,
                canonicalJobUrl: disc.url,
                applyUrl: disc.url,
                jobLocation: detail?.location || disc.location || null,
                jobTeam: disc.team || null,
                employmentType: detectEmploymentType(
                  detail?.title || disc.title,
                ),
                sourcePlatform: platform as any,
                descriptionHtml: detail?.description || null,
                descriptionText: detail?.description || null,
                qualityScore: quality.toFixed(2),
                parseMethod: parseMethod,
                seniority: detectSeniority(detail?.title || disc.title),
                isRemote: detectRemote(
                  detail?.title || disc.title,
                  detail?.location || disc.location,
                ),
                postedDate: disc.postedDate ? new Date(disc.postedDate) : null,
                tags: [],
              })
              .returning({ id: jobs.id });

            if (!newJob) {
              await publishLog(
                crawlRunId,
                `[WARN] Insert returned no rows for: ${disc.title}`,
              );
            } else {
              // Snapshot
              await db.insert(jobSnapshots).values({
                jobId: newJob.id,
                snapshotData: {
                  title: disc.title,
                  location: disc.location,
                  url: disc.url,
                },
                changeType: "NEW",
              });

              // Event
              await db.insert(events).values({
                eventType: "JOB_DISCOVERED",
                entityId: newJob.id,
                entityType: "job",
                correlationId: crawlRunId,
                metadata: {
                  title: disc.title,
                  location: disc.location,
                  company: companyName,
                  parseMethod,
                  quality,
                },
              });

              // Fan out to user_alerts (email/Slack). No-op if user has no matching alerts.
              if (companyUserId) {
                void notifyJobDiscovered(pool, companyUserId, {
                  jobId: newJob.id,
                  title: detail?.title || disc.title,
                  company: companyName,
                  location: detail?.location || disc.location || null,
                  url: disc.url,
                });
              }
            }

            jobsDiscovered++;
            await publishLog(
              crawlRunId,
              `[db] saved "${detail?.title || disc.title}" @ ${detail?.location || disc.location || "N/A"}`,
            );
          }

          // Update crawl run progress after each batch of 5
          if ((i + 1) % 5 === 0 || i === discovered.length - 1) {
            await db
              .update(crawlRuns)
              .set({
                jobsDiscovered,
                jobsUpdated,
                errorCount,
                pagesFetched,
              })
              .where(eq(crawlRuns.id, crawlRunId));

            await publishLog(
              crawlRunId,
              `[db] checkpoint: ${jobsDiscovered + jobsUpdated} jobs persisted so far`,
            );
          }

          // Rate limiting: small delay between jobs
          if (i < discovered.length - 1) {
            await new Promise((r) => setTimeout(r, 200));
          }
        } catch (error) {
          errorCount++;
          await publishLog(
            crawlRunId,
            `[ERROR] Failed to process: ${disc.title} — ${error instanceof Error ? error.message : "Unknown"}`,
          );
        }
      }

      // Mark crawl as complete
      const durationMs = Date.now() - startTime;
      await db
        .update(crawlRuns)
        .set({
          status: "SUCCESS",
          completedAt: new Date(),
          pagesFetched,
          jobsDiscovered,
          jobsUpdated,
          jobsClosed: 0,
          errorCount,
          durationMs,
        })
        .where(eq(crawlRuns.id, crawlRunId));

      await db
        .update(companies)
        .set({
          crawlStatus: "SUCCESS",
          lastCrawlAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));

      await db.insert(events).values({
        eventType: "CRAWL_COMPLETED",
        entityId: crawlRunId,
        entityType: "crawl_run",
        correlationId: crawlRunId,
        metadata: { jobsDiscovered, jobsUpdated, durationMs, errorCount },
      });

      // Signal completion via SSE
      publisher.publish(
        `crawl:${crawlRunId}`,
        JSON.stringify({
          type: "complete",
          jobsDiscovered,
          jobsUpdated,
          errorCount,
          durationMs,
        }),
      );

      await publishLog(
        crawlRunId,
        `[done] ✓ Crawl complete — ${jobsDiscovered} new, ${jobsUpdated} updated in ${(durationMs / 1000).toFixed(1)}s`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const durationMs = Date.now() - startTime;

      await db
        .update(crawlRuns)
        .set({
          status: "FAILED",
          completedAt: new Date(),
          errorCount: errorCount + 1,
          durationMs,
        })
        .where(eq(crawlRuns.id, crawlRunId));

      await db
        .update(companies)
        .set({
          crawlStatus: "FAILED",
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));

      await db.insert(events).values({
        eventType: "CRAWL_FAILED",
        entityId: crawlRunId,
        entityType: "crawl_run",
        correlationId: crawlRunId,
        metadata: { error: errorMessage },
      });

      await publishLog(crawlRunId, `[FAILED] ${errorMessage}`);
      publisher.publish(
        `crawl:${crawlRunId}`,
        JSON.stringify({ type: "error", error: errorMessage }),
      );

      throw error;
    }
  },
  { connection: redis, concurrency: 2 },
);

// ============================================================
// LEGACY ANALYZE-JOB WORKER (kept for backward compat)
// ============================================================

const analyzeWorker = new Worker<AnalyzeJobData>(
  "analyze-job",
  async (job: Job<AnalyzeJobData>) => {
    const { jobAnalysisId, jobUrl, companyOverride } = job.data;
    console.log(`Processing job analysis: ${jobAnalysisId} for ${jobUrl}`);

    await db
      .update(jobAnalyses)
      .set({ status: "RUNNING", updatedAt: new Date() })
      .where(eq(jobAnalyses.id, jobAnalysisId));

    try {
      let result = await extractWithFetch(jobUrl);
      if (!result || (!result.title && !result.company)) {
        console.log("Fetch failed or incomplete, trying Playwright...");
        result = await extractWithPlaywright(jobUrl);
      }

      if (result && companyOverride && !result.company) {
        result.company = companyOverride;
      }

      if (
        !result ||
        (!result.title && !result.company && !result.description)
      ) {
        throw new Error("Could not extract any data from the URL");
      }

      await db
        .update(jobAnalyses)
        .set({ status: "DONE", result, updatedAt: new Date() })
        .where(eq(jobAnalyses.id, jobAnalysisId));
      console.log(`Job analysis completed: ${jobAnalysisId}`, result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Job analysis failed: ${jobAnalysisId}`, errorMessage);
      await db
        .update(jobAnalyses)
        .set({ status: "FAILED", error: errorMessage, updatedAt: new Date() })
        .where(eq(jobAnalyses.id, jobAnalysisId));
      throw error;
    }
  },
  { connection: redis, concurrency: 3 },
);

// ============================================================
// EVENT HANDLERS
// ============================================================

crawlWorker.on("completed", (job) =>
  console.log(`Crawl job ${job.id} completed`),
);
crawlWorker.on("failed", (job, error) =>
  console.error(`Crawl job ${job?.id} failed:`, error.message),
);
analyzeWorker.on("completed", (job) =>
  console.log(`Analyze job ${job.id} completed`),
);
analyzeWorker.on("failed", (job, error) =>
  console.error(`Analyze job ${job?.id} failed:`, error.message),
);

console.log("Worker started. Listening for: crawl-career-page, analyze-job");

// Auto-crawl scheduler — re-crawls companies whose crawlSchedule is DAILY/WEEKLY
startScheduler(pool, redis);
