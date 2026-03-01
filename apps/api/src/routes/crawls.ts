import { Router, Request, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { Redis } from 'ioredis';

const router = Router();
router.use(authenticate);

// GET /crawls — recent crawl runs
router.get('/', async (req: Request, res: Response) => {
    try {
        const { companyId, status, limit = '20' } = req.query;
        const conditions = [];

        // Only show crawls for the user's companies
        const userCompanyIds = await db
            .select({ id: schema.companies.id })
            .from(schema.companies)
            .where(eq(schema.companies.userId, req.user!.id));

        if (userCompanyIds.length === 0) {
            return res.json([]);
        }

        conditions.push(
            sql`${schema.crawlRuns.companyId} IN (${sql.join(
                userCompanyIds.map((c) => sql`${c.id}`),
                sql`, `
            )})`
        );

        if (companyId && typeof companyId === 'string') {
            conditions.push(eq(schema.crawlRuns.companyId, companyId));
        }
        if (status && typeof status === 'string') {
            conditions.push(eq(schema.crawlRuns.status, status as any));
        }

        const crawls = await db
            .select({
                id: schema.crawlRuns.id,
                companyId: schema.crawlRuns.companyId,
                companyName: schema.companies.name,
                status: schema.crawlRuns.status,
                startedAt: schema.crawlRuns.startedAt,
                completedAt: schema.crawlRuns.completedAt,
                pagesFetched: schema.crawlRuns.pagesFetched,
                jobsDiscovered: schema.crawlRuns.jobsDiscovered,
                jobsUpdated: schema.crawlRuns.jobsUpdated,
                jobsClosed: schema.crawlRuns.jobsClosed,
                errorCount: schema.crawlRuns.errorCount,
                durationMs: schema.crawlRuns.durationMs,
                createdAt: schema.crawlRuns.createdAt,
            })
            .from(schema.crawlRuns)
            .leftJoin(schema.companies, eq(schema.crawlRuns.companyId, schema.companies.id))
            .where(and(...conditions))
            .orderBy(desc(schema.crawlRuns.createdAt))
            .limit(parseInt(limit as string, 10));

        return res.json(crawls);
    } catch (error) {
        console.error('List crawls error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /crawls/:id — crawl run detail with logs
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const [crawl] = await db
            .select()
            .from(schema.crawlRuns)
            .where(eq(schema.crawlRuns.id, req.params.id))
            .limit(1);

        if (!crawl) {
            return res.status(404).json({ error: 'Crawl run not found' });
        }

        return res.json(crawl);
    } catch (error) {
        console.error('Get crawl error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /crawls/:id/stream — SSE live log stream
router.get('/:id/stream', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const crawlRunId = req.params.id;
    const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    const channel = `crawl:${crawlRunId}`;

    const onMessage = (_ch: string, message: string) => {
        res.write(`data: ${message}\n\n`);
    };

    subscriber.subscribe(channel);
    subscriber.on('message', onMessage);

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', crawlRunId })}\n\n`);

    // Send current crawl status
    const [crawl] = await db
        .select()
        .from(schema.crawlRuns)
        .where(eq(schema.crawlRuns.id, crawlRunId))
        .limit(1);

    if (crawl) {
        res.write(`data: ${JSON.stringify({ type: 'status', status: crawl.status, logs: crawl.logs })}\n\n`);
    }

    // Cleanup on disconnect
    req.on('close', () => {
        subscriber.unsubscribe(channel);
        subscriber.disconnect();
    });
});

export default router;
