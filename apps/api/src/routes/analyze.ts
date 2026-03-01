import { Router, Request, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { detectPlatform, guessCompanyName, isJobPosting } from '../lib/platforms.js';
import { emitEvent } from '../lib/events.js';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

const crawlQueue = new Queue('crawl-career-page', { connection: redis });
const analyzeQueue = new Queue('analyze-job', { connection: redis });

const router = Router();
router.use(authenticate);

const AnalyzeSchema = z.object({
    url: z.string().url(),
    companyOverride: z.string().optional(),
});

/**
 * POST /analyze
 * Universal entry point for any job-related URL.
 * Automatically routes to "Crawl Career Portal" or "Analyze Single Job".
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const parsed = AnalyzeSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
        }

        const { url, companyOverride } = parsed.data;
        const platform = detectPlatform(url);
        const name = companyOverride || guessCompanyName(url);
        const isJob = isJobPosting(url);

        if (isJob) {
            // Handle Single Job Detail
            const results = await db
                .insert(schema.jobAnalyses)
                .values({
                    userId: req.user!.id,
                    jobUrl: url,
                    status: 'PENDING',
                })
                .returning();

            const analysis = results[0];
            if (!analysis) {
                return res.status(500).json({ error: 'Failed to create analysis record' });
            }

            await analyzeQueue.add('analyze', {
                jobAnalysisId: analysis.id,
                jobUrl: url,
                userId: req.user!.id,
                companyOverride: name,
            });

            return res.status(202).json({
                type: 'JOB',
                jobAnalysisId: analysis.id,
                status: 'PENDING',
            });
        } else {
            // Handle Career Portal
            // Check if company already exists for this user
            let [company] = await db
                .select()
                .from(schema.companies)
                .where(and(eq(schema.companies.userId, req.user!.id), eq(schema.companies.careerUrl, url)))
                .limit(1);

            if (!company) {
                const companyResults = await db
                    .insert(schema.companies)
                    .values({
                        userId: req.user!.id,
                        name: name,
                        careerUrl: url,
                        sourcePlatform: platform,
                        crawlStatus: 'QUEUED',
                    })
                    .returning();
                company = companyResults[0];
            }

            if (!company) {
                return res.status(500).json({ error: 'Failed to process company' });
            }

            const crawlResults = await db
                .insert(schema.crawlRuns)
                .values({
                    companyId: company.id,
                    status: 'QUEUED',
                })
                .returning();

            const crawlRun = crawlResults[0];
            if (!crawlRun) {
                return res.status(500).json({ error: 'Failed to create crawl run' });
            }

            await crawlQueue.add('crawl', {
                companyId: company.id,
                careerUrl: url,
                crawlRunId: crawlRun.id,
                platform,
            });

            return res.status(202).json({
                type: 'PORTAL',
                companyId: company.id,
                crawlRunId: crawlRun.id,
                status: 'QUEUED',
            });
        }
    } catch (error) {
        console.error('Universal analyze error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
