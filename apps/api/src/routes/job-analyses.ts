import { Router, Request, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /job-analyses/:id
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const [analysis] = await db
            .select()
            .from(schema.jobAnalyses)
            .where(and(eq(schema.jobAnalyses.id, id), eq(schema.jobAnalyses.userId, req.user!.id)))
            .limit(1);

        if (!analysis) {
            return res.status(404).json({ error: 'Job analysis not found' });
        }

        return res.json({
            id: analysis.id,
            userId: analysis.userId,
            jobUrl: analysis.jobUrl,
            status: analysis.status,
            result: analysis.result,
            error: analysis.error,
            createdAt: analysis.createdAt.toISOString(),
            updatedAt: analysis.updatedAt.toISOString(),
        });
    } catch (error) {
        console.error('Get job analysis error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
