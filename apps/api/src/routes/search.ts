import { Router, Request, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, ilike, or, desc, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /search?q=query — global search across companies + jobs
router.get('/', async (req: Request, res: Response) => {
    try {
        const { q, limit = '20' } = req.query;

        if (!q || typeof q !== 'string' || q.trim().length < 2) {
            return res.json({ companies: [], jobs: [] });
        }

        const searchTerm = `%${q.trim()}%`;
        const maxResults = Math.min(parseInt(limit as string, 10) || 20, 50);

        // Search companies
        const companies = await db
            .select({
                id: schema.companies.id,
                name: schema.companies.name,
                careerUrl: schema.companies.careerUrl,
                sourcePlatform: schema.companies.sourcePlatform,
                crawlStatus: schema.companies.crawlStatus,
                lastCrawlAt: schema.companies.lastCrawlAt,
            })
            .from(schema.companies)
            .where(
                and(
                    eq(schema.companies.userId, req.user!.id),
                    ilike(schema.companies.name, searchTerm)
                )
            )
            .orderBy(desc(schema.companies.updatedAt))
            .limit(maxResults);

        // Search jobs (scoped to user's companies)
        const userCompanyIds = await db
            .select({ id: schema.companies.id })
            .from(schema.companies)
            .where(eq(schema.companies.userId, req.user!.id));

        let jobs: any[] = [];
        if (userCompanyIds.length > 0) {
            jobs = await db
                .select({
                    id: schema.jobs.id,
                    jobTitle: schema.jobs.jobTitle,
                    jobSlug: schema.jobs.jobSlug,
                    jobLocation: schema.jobs.jobLocation,
                    jobTeam: schema.jobs.jobTeam,
                    status: schema.jobs.status,
                    lastSeenAt: schema.jobs.lastSeenAt,
                    companyName: schema.companies.name,
                    companyId: schema.jobs.companyId,
                })
                .from(schema.jobs)
                .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
                .where(
                    and(
                        sql`${schema.jobs.companyId} IN (${sql.join(
                            userCompanyIds.map((c) => sql`${c.id}`),
                            sql`, `
                        )})`,
                        or(
                            ilike(schema.jobs.jobTitle, searchTerm),
                            ilike(schema.jobs.jobLocation, searchTerm),
                            ilike(schema.jobs.jobTeam, searchTerm)
                        )
                    )
                )
                .orderBy(desc(schema.jobs.lastSeenAt))
                .limit(maxResults);
        }

        return res.json({ companies, jobs });
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
