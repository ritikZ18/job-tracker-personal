import { Router, Request, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, desc, ilike, or, sql, gte } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /jobs — list all jobs with search, filters, pagination
router.get('/', async (req: Request, res: Response) => {
    try {
        const {
            search,
            companyId,
            location,
            team,
            status,
            minDate,
            remote,
            sort = 'lastSeenAt',
            order = 'desc',
            limit = '50',
            offset = '0',
        } = req.query;

        const conditions = [];

        // Only show jobs from the user's companies
        const userCompanyIds = await db
            .select({ id: schema.companies.id })
            .from(schema.companies)
            .where(eq(schema.companies.userId, req.user!.id));

        if (userCompanyIds.length === 0) {
            return res.json({ jobs: [], total: 0 });
        }

        conditions.push(
            or(
                ...userCompanyIds.map((c) => eq(schema.jobs.companyId, c.id))
            )!
        );

        if (search && typeof search === 'string') {
            conditions.push(
                or(
                    ilike(schema.jobs.jobTitle, `%${search}%`),
                    ilike(schema.jobs.jobLocation, `%${search}%`),
                    ilike(schema.jobs.jobTeam, `%${search}%`)
                )!
            );
        }
        if (companyId && typeof companyId === 'string') {
            conditions.push(eq(schema.jobs.companyId, companyId));
        }
        if (location && typeof location === 'string') {
            conditions.push(ilike(schema.jobs.jobLocation, `%${location}%`));
        }
        if (team && typeof team === 'string') {
            conditions.push(ilike(schema.jobs.jobTeam, `%${team}%`));
        }
        if (status && typeof status === 'string') {
            conditions.push(eq(schema.jobs.status, status as any));
        }
        if (minDate && typeof minDate === 'string') {
            conditions.push(gte(schema.jobs.firstSeenAt, new Date(minDate)));
        }
        if (remote === 'true') {
            conditions.push(eq(schema.jobs.isRemote, true));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Count
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.jobs)
            .where(whereClause);

        // Query
        const jobs = await db
            .select({
                id: schema.jobs.id,
                companyId: schema.jobs.companyId,
                jobTitle: schema.jobs.jobTitle,
                jobSlug: schema.jobs.jobSlug,
                canonicalJobUrl: schema.jobs.canonicalJobUrl,
                jobLocation: schema.jobs.jobLocation,
                jobTeam: schema.jobs.jobTeam,
                employmentType: schema.jobs.employmentType,
                postedDate: schema.jobs.postedDate,
                firstSeenAt: schema.jobs.firstSeenAt,
                lastSeenAt: schema.jobs.lastSeenAt,
                status: schema.jobs.status,
                applyUrl: schema.jobs.applyUrl,
                sourcePlatform: schema.jobs.sourcePlatform,
                salaryRange: schema.jobs.salaryRange,
                seniority: schema.jobs.seniority,
                isRemote: schema.jobs.isRemote,
                tags: schema.jobs.tags,
                companyName: schema.companies.name,
            })
            .from(schema.jobs)
            .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
            .where(whereClause)
            .orderBy(order === 'asc' ? sql`${sql.identifier(sort as string)} ASC` : desc(schema.jobs.lastSeenAt))
            .limit(parseInt(limit as string, 10))
            .offset(parseInt(offset as string, 10));

        return res.json({ jobs, total: count });
    } catch (error) {
        console.error('List jobs error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /jobs/:slug — job detail
router.get('/:slug', async (req: Request, res: Response) => {
    try {
        const [job] = await db
            .select({
                id: schema.jobs.id,
                companyId: schema.jobs.companyId,
                companyName: schema.companies.name,
                companyCareerUrl: schema.companies.careerUrl,
                jobTitle: schema.jobs.jobTitle,
                jobSlug: schema.jobs.jobSlug,
                canonicalJobUrl: schema.jobs.canonicalJobUrl,
                jobLocation: schema.jobs.jobLocation,
                jobTeam: schema.jobs.jobTeam,
                employmentType: schema.jobs.employmentType,
                postedDate: schema.jobs.postedDate,
                firstSeenAt: schema.jobs.firstSeenAt,
                lastSeenAt: schema.jobs.lastSeenAt,
                status: schema.jobs.status,
                descriptionHtml: schema.jobs.descriptionHtml,
                descriptionText: schema.jobs.descriptionText,
                applyUrl: schema.jobs.applyUrl,
                sourcePlatform: schema.jobs.sourcePlatform,
                salaryRange: schema.jobs.salaryRange,
                seniority: schema.jobs.seniority,
                isRemote: schema.jobs.isRemote,
                tags: schema.jobs.tags,
            })
            .from(schema.jobs)
            .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
            .where(eq(schema.jobs.jobSlug, req.params.slug))
            .limit(1);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Get snapshots
        const snapshots = await db
            .select()
            .from(schema.jobSnapshots)
            .where(eq(schema.jobSnapshots.jobId, job.id))
            .orderBy(desc(schema.jobSnapshots.capturedAt))
            .limit(20);

        return res.json({ ...job, snapshots });
    } catch (error) {
        console.error('Get job error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /jobs/:slug/save — save job as application
router.post('/:slug/save', async (req: Request, res: Response) => {
    try {
        const [job] = await db
            .select()
            .from(schema.jobs)
            .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
            .where(eq(schema.jobs.jobSlug, req.params.slug))
            .limit(1);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const [application] = await db
            .insert(schema.applications)
            .values({
                userId: req.user!.id,
                jobId: job.jobs.id,
                company: job.companies?.name || 'Unknown',
                jobTitle: job.jobs.jobTitle,
                jobUrl: job.jobs.canonicalJobUrl,
                jobDescription: job.jobs.descriptionText,
                source: 'CRAWLED',
                status: 'SAVED',
            })
            .returning();

        return res.status(201).json(application);
    } catch (error) {
        console.error('Save job error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
