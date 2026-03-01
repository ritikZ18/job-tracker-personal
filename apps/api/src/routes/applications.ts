import { Router, Request, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, desc, ilike, or, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import {
    CreateApplicationSchema,
    UpdateApplicationSchema,
    UpdateStatusSchema,
    AnalyzeJobUrlSchema,
} from '@repo/types';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});
const analyzeQueue = new Queue('analyze-job', { connection: redis });

const router = Router();

// All routes require authentication
router.use(authenticate);

// Admin-only global view
router.get('/admin/all', async (req: Request, res: Response) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const apps = await db
            .select({
                id: schema.applications.id,
                company: schema.applications.company,
                jobTitle: schema.applications.jobTitle,
                status: schema.applications.status,
                createdAt: schema.applications.createdAt,
                userEmail: schema.users.email,
            })
            .from(schema.applications)
            .innerJoin(schema.users, eq(schema.applications.userId, schema.users.id))
            .orderBy(desc(schema.applications.createdAt));

        return res.json(apps.map(app => ({
            ...app,
            createdAt: app.createdAt.toISOString()
        })));
    } catch (error) {
        console.error('Admin get apps error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /applications
router.get('/', async (req: Request, res: Response) => {
    try {
        const {
            status,
            search,
            sort = 'createdAt',
            order = 'desc',
        } = req.query;

        let query = db
            .select()
            .from(schema.applications)
            .where(eq(schema.applications.userId, req.user!.id));

        // Apply filters
        const conditions = [eq(schema.applications.userId, req.user!.id)];

        if (status && typeof status === 'string') {
            conditions.push(eq(schema.applications.status, status as any));
        }

        if (search && typeof search === 'string') {
            conditions.push(
                or(
                    ilike(schema.applications.company, `%${search}%`),
                    ilike(schema.applications.jobTitle, `%${search}%`)
                )!
            );
        }

        const apps = await db
            .select()
            .from(schema.applications)
            .where(and(...conditions))
            .orderBy(
                order === 'asc'
                    ? sql`${sql.identifier(sort as string)} ASC`
                    : desc(schema.applications.createdAt)
            );

        return res.json(
            apps.map((app) => ({
                ...app,
                appliedAt: app.appliedAt?.toISOString() || null,
                interviewingAt: app.interviewingAt?.toISOString() || null,
                offerAt: app.offerAt?.toISOString() || null,
                rejectedAt: app.rejectedAt?.toISOString() || null,
                ghostedAt: app.ghostedAt?.toISOString() || null,
                createdAt: app.createdAt.toISOString(),
                updatedAt: app.updatedAt.toISOString(),
            }))
        );
    } catch (error) {
        console.error('Get applications error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /applications
router.post('/', async (req: Request, res: Response) => {
    try {
        const parsed = CreateApplicationSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
        }

        const [app] = await db
            .insert(schema.applications)
            .values({
                ...parsed.data,
                userId: req.user!.id,
                appliedAt: parsed.data.appliedAt ? new Date(parsed.data.appliedAt) : new Date(),
            })
            .returning();

        if (!app) {
            return res.status(500).json({ error: 'Failed to create application' });
        }

        // Create audit event
        await db.insert(schema.applicationEvents).values({
            applicationId: app.id,
            type: 'CREATED',
            payload: { data: parsed.data },
        });

        return res.status(201).json({
            ...app,
            appliedAt: app.appliedAt?.toISOString() || null,
            interviewingAt: app.interviewingAt?.toISOString() || null,
            offerAt: app.offerAt?.toISOString() || null,
            rejectedAt: app.rejectedAt?.toISOString() || null,
            ghostedAt: app.ghostedAt?.toISOString() || null,
            createdAt: app.createdAt.toISOString(),
            updatedAt: app.updatedAt.toISOString(),
        });
    } catch (error) {
        console.error('Create application error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /applications/:id
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = UpdateApplicationSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
        }

        // Check ownership
        const results = await db
            .select()
            .from(schema.applications)
            .where(and(eq(schema.applications.id, id as string), eq(schema.applications.userId, req.user!.id)))
            .limit(1);

        const existing = results[0];

        if (!existing) {
            return res.status(404).json({ error: 'Application not found' });
        }

        const [updated] = await db
            .update(schema.applications)
            .set({
                ...parsed.data,
                appliedAt: parsed.data.appliedAt ? new Date(parsed.data.appliedAt) : undefined,
                updatedAt: new Date(),
            })
            .where(eq(schema.applications.id, id as string))
            .returning();

        if (!updated) {
            return res.status(500).json({ error: 'Failed to update application' });
        }

        // Create audit event
        await db.insert(schema.applicationEvents).values({
            applicationId: id as string,
            type: 'FIELD_EDIT',
            payload: { previous: existing, updated: parsed.data },
        });

        return res.json({
            ...updated,
            appliedAt: updated.appliedAt?.toISOString() || null,
            rejectedAt: updated.rejectedAt?.toISOString() || null,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        });
    } catch (error) {
        console.error('Update application error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /applications/:id/status - Special endpoint for status changes
router.patch('/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = UpdateStatusSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
        }

        // Check ownership
        const results = await db
            .select()
            .from(schema.applications)
            .where(and(eq(schema.applications.id, id as string), eq(schema.applications.userId, req.user!.id)))
            .limit(1);

        const existing = results[0];

        if (!existing) {
            return res.status(404).json({ error: 'Application not found' });
        }

        const updates: any = {
            status: parsed.data.status,
            updatedAt: new Date(),
        };

        // Auto-stamp dates based on status
        if (parsed.data.status === 'INTERVIEWING' && !existing.interviewingAt) {
            updates.interviewingAt = new Date();
        } else if (parsed.data.status === 'OFFER' && !existing.offerAt) {
            updates.offerAt = new Date();
        } else if (parsed.data.status === 'REJECTED' && !existing.rejectedAt) {
            updates.rejectedAt = new Date();
        } else if (parsed.data.status === 'GHOSTED' && !existing.ghostedAt) {
            updates.ghostedAt = new Date();
        }

        const [updated] = await db
            .update(schema.applications)
            .set(updates)
            .where(eq(schema.applications.id, id as string))
            .returning();

        if (!updated) {
            return res.status(500).json({ error: 'Failed to update status' });
        }

        // Create audit event
        await db.insert(schema.applicationEvents).values({
            applicationId: id as string,
            type: 'STATUS_CHANGED',
            payload: { from: existing.status, to: parsed.data.status },
        });

        return res.json({
            ...updated,
            appliedAt: updated.appliedAt?.toISOString() || null,
            rejectedAt: updated.rejectedAt?.toISOString() || null,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        });
    } catch (error) {
        console.error('Update status error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /applications/analyze - Enqueue job URL analysis
router.post('/analyze', async (req: Request, res: Response) => {
    try {
        const parsed = AnalyzeJobUrlSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
        }

        // Create job analysis record
        const results = await db
            .insert(schema.jobAnalyses)
            .values({
                userId: req.user!.id,
                jobUrl: parsed.data.jobUrl,
                status: 'PENDING',
            })
            .returning();

        const analysis = results[0];
        if (!analysis) {
            return res.status(500).json({ error: 'Failed to create analysis record' });
        }

        // Enqueue for processing
        await analyzeQueue.add('analyze', {
            jobAnalysisId: analysis.id,
            jobUrl: parsed.data.jobUrl,
            userId: req.user!.id,
        });

        return res.status(202).json({
            jobAnalysisId: analysis.id,
            status: 'PENDING',
        });
    } catch (error) {
        console.error('Analyze error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /applications/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check ownership
        const results = await db
            .select({ id: schema.applications.id })
            .from(schema.applications)
            .where(and(eq(schema.applications.id, id as string), eq(schema.applications.userId, req.user!.id)))
            .limit(1);

        const existing = results[0];

        if (!existing) {
            return res.status(404).json({ error: 'Application not found' });
        }

        await db.delete(schema.applications).where(eq(schema.applications.id, id as string));

        return res.status(204).send();
    } catch (error) {
        console.error('Delete application error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
