import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type pg from "pg";

const SCHEDULER_TICK_MS =
  Number(process.env.SCHEDULER_TICK_MS) || 5 * 60 * 1000;
const BATCH_LIMIT = Number(process.env.SCHEDULER_BATCH_LIMIT) || 50;

interface CompanyDue {
  id: string;
  career_url: string;
  source_platform: string;
  name: string;
}

/**
 * Find companies whose crawlSchedule (DAILY|WEEKLY) makes them due for a re-crawl.
 *
 * Reuses the existing `last_crawl_at` column. A company is due when:
 *   - crawl_schedule != 'MANUAL'
 *   - lastCrawlAt is NULL OR lastCrawlAt < NOW() - INTERVAL_FOR_SCHEDULE
 *   - There is no concurrent QUEUED/RUNNING crawl for the company
 */
async function findDueCompanies(pool: pg.Pool): Promise<CompanyDue[]> {
  const result = await pool.query<CompanyDue>(
    `
        SELECT c.id, c.career_url, c.source_platform, c.name
        FROM companies c
        WHERE c.crawl_schedule IN ('DAILY', 'WEEKLY')
          AND (
            c.last_crawl_at IS NULL
            OR (c.crawl_schedule = 'DAILY'  AND c.last_crawl_at < NOW() - INTERVAL '24 hours')
            OR (c.crawl_schedule = 'WEEKLY' AND c.last_crawl_at < NOW() - INTERVAL '7 days')
          )
          AND NOT EXISTS (
            SELECT 1 FROM crawl_runs cr
            WHERE cr.company_id = c.id
              AND cr.status IN ('QUEUED', 'RUNNING')
          )
        ORDER BY c.last_crawl_at ASC NULLS FIRST
        LIMIT $1
    `,
    [BATCH_LIMIT],
  );
  return result.rows;
}

async function enqueueCrawl(
  pool: pg.Pool,
  crawlQueue: Queue,
  company: CompanyDue,
): Promise<void> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO crawl_runs (company_id, status) VALUES ($1, 'QUEUED') RETURNING id`,
    [company.id],
  );
  const crawlRunId = rows[0]?.id;
  if (!crawlRunId) return;

  await pool.query(
    `UPDATE companies SET crawl_status = 'QUEUED', updated_at = NOW() WHERE id = $1`,
    [company.id],
  );

  await crawlQueue.add(
    "crawl",
    {
      companyId: company.id,
      careerUrl: company.career_url,
      crawlRunId,
      platform: company.source_platform,
      trigger: "scheduled",
    },
    {
      priority: 10,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  );
}

async function tick(pool: pg.Pool, crawlQueue: Queue): Promise<void> {
  try {
    const due = await findDueCompanies(pool);
    if (due.length === 0) return;
    console.log(`[scheduler] ${due.length} companies due for auto-crawl`);
    for (const company of due) {
      try {
        await enqueueCrawl(pool, crawlQueue, company);
      } catch (err) {
        console.error(`[scheduler] failed to enqueue ${company.name}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] tick error:", err);
  }
}

export function startScheduler(pool: pg.Pool, redis: Redis): NodeJS.Timeout {
  const crawlQueue = new Queue("crawl-career-page", { connection: redis });
  console.log(
    `[scheduler] auto-crawl scheduler started (tick=${SCHEDULER_TICK_MS}ms, batch=${BATCH_LIMIT})`,
  );

  // Run once on startup, then on the interval.
  void tick(pool, crawlQueue);
  return setInterval(() => void tick(pool, crawlQueue), SCHEDULER_TICK_MS);
}
