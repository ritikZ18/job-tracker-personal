import { Router, Request, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { CreateViewSchema } from '@repo/types';

const router = Router();
router.use(authenticate);

// GET /views
router.get('/', async (req: Request, res: Response) => {
    try {
        const views = await db
            .select()
            .from(schema.views)
            .where(eq(schema.views.userId, req.user!.id));

        return res.json(
            views.map((v) => ({
                ...v,
                createdAt: v.createdAt.toISOString(),
            }))
        );
    } catch (error) {
        console.error('Get views error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /views
router.post('/', async (req: Request, res: Response) => {
    try {
        const parsed = CreateViewSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
        }

        const [view] = await db
            .insert(schema.views)
            .values({
                userId: req.user!.id,
                name: parsed.data.name,
                config: parsed.data.config,
            })
            .returning();

        return res.status(201).json({
            ...view,
            createdAt: view.createdAt.toISOString(),
        });
    } catch (error) {
        console.error('Create view error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /views/:id
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = CreateViewSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
        }

        const [existing] = await db
            .select()
            .from(schema.views)
            .where(and(eq(schema.views.id, id), eq(schema.views.userId, req.user!.id)))
            .limit(1);

        if (!existing) {
            return res.status(404).json({ error: 'View not found' });
        }

        const [updated] = await db
            .update(schema.views)
            .set({
                name: parsed.data.name,
                config: parsed.data.config,
            })
            .where(eq(schema.views.id, id))
            .returning();

        return res.json({
            ...updated,
            createdAt: updated.createdAt.toISOString(),
        });
    } catch (error) {
        console.error('Update view error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /views/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const [existing] = await db
            .select()
            .from(schema.views)
            .where(and(eq(schema.views.id, id), eq(schema.views.userId, req.user!.id)))
            .limit(1);

        if (!existing) {
            return res.status(404).json({ error: 'View not found' });
        }

        await db.delete(schema.views).where(eq(schema.views.id, id));

        return res.status(204).send();
    } catch (error) {
        console.error('Delete view error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
