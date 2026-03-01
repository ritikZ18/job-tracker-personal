import { Router, Request, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, desc, ilike, or, sql, isNull } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { emitEvent } from '../lib/events.js';
import { z } from 'zod';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});
const crawlQueue = new Queue('crawl-career-page', { connection: redis });

const router = Router();
router.use(authenticate);

const AddCompanySchema = z.object({
    careerUrl: z.string().url(),
    name: z.string().optional(),
});

const BulkAddSchema = z.object({
    urls: z.array(z.object({
        careerUrl: z.string().url(),
        name: z.string().optional(),
    })).min(1).max(100),
});

/** Detect ATS platform from URL */
function detectPlatform(url: string): 'GREENHOUSE' | 'LEVER' | 'WORKDAY' | 'ICIMS' | 'CUSTOM' | 'UNKNOWN' {
    const lower = url.toLowerCase();
    if (lower.includes('greenhouse.io') || lower.includes('boards.greenhouse')) return 'GREENHOUSE';
    if (lower.includes('lever.co') || lower.includes('jobs.lever')) return 'LEVER';
    if (lower.includes('myworkdayjobs') || lower.includes('workday.com')) return 'WORKDAY';
    if (lower.includes('icims.com')) return 'ICIMS';
    return 'UNKNOWN';
}

/** Extract company name from URL if not provided */
function guessCompanyName(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        // e.g., "jobs.lever.co/companyname" → "companyname"
        const parts = new URL(url).pathname.split('/').filter(Boolean);
        if (hostname.includes('lever.co') && parts[0]) return parts[0];
        if (hostname.includes('greenhouse.io') && parts[0]) return parts[0];
        // Generic: use hostname minus extension
        return hostname.replace(/^(www|jobs|careers?|boards?)\./, '').split('.')[0] || 'Unknown';
    } catch {
        return 'Unknown';
    }
}

// GET /companies — list user's companies
router.get('/', async (req: Request, res: Response) => {
    try {
        const { search, status, hasNewJobs } = req.query;

        const conditions = [eq(schema.companies.userId, req.user!.id)];

        if (search && typeof search === 'string') {
            conditions.push(ilike(schema.companies.name, `%${search}%`));
        }
        if (status && typeof status === 'string') {
            conditions.push(eq(schema.companies.crawlStatus, status as any));
        }

        const result = await db
            .select()
            .from(schema.companies)
            .where(and(...conditions))
            .orderBy(desc(schema.companies.updatedAt));

        // Enrich with job counts
        const enriched = await Promise.all(
            result.map(async (company) => {
                const [jobCount] = await db
                    .select({ count: sql<number>`count(*)::int` })
                    .from(schema.jobs)
                    .where(eq(schema.jobs.companyId, company.id));

                const [newJobCount] = await db
                    .select({ count: sql<number>`count(*)::int` })
                    .from(schema.jobs)
                    .where(
                        and(
                            eq(schema.jobs.companyId, company.id),
                            sql`${schema.jobs.firstSeenAt} >= NOW() - INTERVAL '7 days'`
                        )
                    );

                return {
                    ...company,
                    jobCount: jobCount?.count || 0,
                    newJobCount: newJobCount?.count || 0,
                };
            })
        );

        // Optional: filter by hasNewJobs after enrichment
        let final = enriched;
        if (hasNewJobs === 'true') {
            final = enriched.filter((c) => c.newJobCount > 0);
        }

        return res.json(final);
    } catch (error) {
        console.error('List companies error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /companies — add single company
router.post('/', async (req: Request, res: Response) => {
    try {
        const parsed = AddCompanySchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
        }

        const { careerUrl, name } = parsed.data;
        const platform = detectPlatform(careerUrl);
        const companyName = name || guessCompanyName(careerUrl);

        const [company] = await db
            .insert(schema.companies)
            .values({
                userId: req.user!.id,
                name: companyName,
                careerUrl,
                sourcePlatform: platform,
                crawlStatus: 'QUEUED',
            })
            .returning();

        await emitEvent('COMPANY_ADDED', company.id, 'company', {
            name: companyName,
            careerUrl,
            platform,
        });

        // Auto-enqueue crawl
        const [crawlRun] = await db
            .insert(schema.crawlRuns)
            .values({
                companyId: company.id,
                status: 'QUEUED',
            })
            .returning();

        await crawlQueue.add('crawl', {
            companyId: company.id,
            careerUrl,
            crawlRunId: crawlRun.id,
            platform,
        });

        return res.status(201).json({ ...company, crawlRunId: crawlRun.id });
    } catch (error) {
        console.error('Add company error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /companies/bulk — bulk add
router.post('/bulk', async (req: Request, res: Response) => {
    try {
        const parsed = BulkAddSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
        }

        const results = [];
        for (const entry of parsed.data.urls) {
            const platform = detectPlatform(entry.careerUrl);
            const companyName = entry.name || guessCompanyName(entry.careerUrl);

            const [company] = await db
                .insert(schema.companies)
                .values({
                    userId: req.user!.id,
                    name: companyName,
                    careerUrl: entry.careerUrl,
                    sourcePlatform: platform,
                    crawlStatus: 'QUEUED',
                })
                .returning();

            const [crawlRun] = await db
                .insert(schema.crawlRuns)
                .values({ companyId: company.id, status: 'QUEUED' })
                .returning();

            await crawlQueue.add('crawl', {
                companyId: company.id,
                careerUrl: entry.careerUrl,
                crawlRunId: crawlRun.id,
                platform,
            });

            results.push({ ...company, crawlRunId: crawlRun.id });
        }

        return res.status(201).json(results);
    } catch (error) {
        console.error('Bulk add error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /companies/:id — detail
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const [company] = await db
            .select()
            .from(schema.companies)
            .where(
                and(
                    eq(schema.companies.id, req.params.id),
                    eq(schema.companies.userId, req.user!.id)
                )
            )
            .limit(1);

        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Get job stats
        const [stats] = await db
            .select({
                total: sql<number>`count(*)::int`,
                open: sql<number>`count(*) filter (where status = 'OPEN')::int`,
                closed: sql<number>`count(*) filter (where status = 'CLOSED')::int`,
                newThisWeek: sql<number>`count(*) filter (where first_seen_at >= NOW() - INTERVAL '7 days')::int`,
            })
            .from(schema.jobs)
            .where(eq(schema.jobs.companyId, company.id));

        return res.json({ ...company, stats });
    } catch (error) {
        console.error('Get company error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /companies/:id — update
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const { name, crawlSchedule, isTarget } = req.body;

        const [updated] = await db
            .update(schema.companies)
            .set({
                ...(name !== undefined && { name }),
                ...(crawlSchedule !== undefined && { crawlSchedule }),
                ...(isTarget !== undefined && { isTarget }),
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(schema.companies.id, req.params.id),
                    eq(schema.companies.userId, req.user!.id)
                )
            )
            .returning();

        if (!updated) {
            return res.status(404).json({ error: 'Company not found' });
        }

        return res.json(updated);
    } catch (error) {
        console.error('Update company error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /companies/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const deleted = await db
            .delete(schema.companies)
            .where(
                and(
                    eq(schema.companies.id, req.params.id),
                    eq(schema.companies.userId, req.user!.id)
                )
            )
            .returning();

        if (!deleted.length) {
            return res.status(404).json({ error: 'Company not found' });
        }

        return res.status(204).send();
    } catch (error) {
        console.error('Delete company error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /companies/:id/crawl — trigger re-crawl
router.post('/:id/crawl', async (req: Request, res: Response) => {
    try {
        const [company] = await db
            .select()
            .from(schema.companies)
            .where(
                and(
                    eq(schema.companies.id, req.params.id),
                    eq(schema.companies.userId, req.user!.id)
                )
            )
            .limit(1);

        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        const [crawlRun] = await db
            .insert(schema.crawlRuns)
            .values({ companyId: company.id, status: 'QUEUED' })
            .returning();

        await db
            .update(schema.companies)
            .set({ crawlStatus: 'QUEUED', updatedAt: new Date() })
            .where(eq(schema.companies.id, company.id));

        await crawlQueue.add('crawl', {
            companyId: company.id,
            careerUrl: company.careerUrl,
            crawlRunId: crawlRun.id,
            platform: company.sourcePlatform,
            preferences: req.body.preferences,
        });

        return res.json({ crawlRunId: crawlRun.id, status: 'QUEUED' });
    } catch (error) {
        console.error('Trigger crawl error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
