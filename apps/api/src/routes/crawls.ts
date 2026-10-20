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
        const { companyId, status, limit = '10', offset = '0' } = req.query;
        const conditions = [];

        // Only show crawls for the user's companies
        const userCompanyIds = await db
            .select({ id: schema.companies.id })
            .from(schema.companies)
            .where(eq(schema.companies.userId, req.user!.id));

        if (userCompanyIds.length === 0) {
            return res.json({ crawls: [], total: 0 });
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

        const totalResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.crawlRuns)
            .where(and(...conditions));
        const total = totalResult[0]?.count || 0;

        const crawls = await db
            .select({
                id: schema.crawlRuns.id,
                companyId: schema.crawlRuns.companyId,
                companyName: schema.companies.name,
                companyLogoUrl: schema.companies.logoUrl,
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
            .limit(parseInt(limit as string, 10))
            .offset(parseInt(offset as string, 10));

        return res.json({ crawls, total });
    } catch (error) {
        console.error('List crawls error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /crawls/:id — remove a crawl run
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        // Verify the crawl belongs to the user
        const [crawl] = await db
            .select({
                id: schema.crawlRuns.id,
                companyId: schema.crawlRuns.companyId,
            })
            .from(schema.crawlRuns)
            .where(eq(schema.crawlRuns.id, id))
            .limit(1);

        if (!crawl) {
            return res.status(404).json({ error: 'Crawl run not found' });
        }

        const [company] = await db
            .select({ id: schema.companies.id })
            .from(schema.companies)
            .where(and(eq(schema.companies.id, crawl.companyId), eq(schema.companies.userId, req.user!.id)))
            .limit(1);

        if (!company) {
            return res.status(403).json({ error: 'Unauthorized to delete this crawl' });
        }

        await db.delete(schema.crawlRuns).where(eq(schema.crawlRuns.id, id));

        return res.status(204).send();
    } catch (error) {
        console.error('Delete crawl error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /crawls/:id — crawl run detail with logs
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const [crawl] = await db
            .select()
            .from(schema.crawlRuns)
            .where(eq(schema.crawlRuns.id, id))
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

    const crawlRunId = req.params.id as string;
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
