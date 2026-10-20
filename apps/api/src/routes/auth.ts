import { Router, Request, Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /auth/me — Get current user profile
router.get('/me', authenticate, (req: Request, res: Response) => {
    return res.json({
        user: {
            id: req.user!.id,
            email: req.user!.email,
            role: req.user!.role,
            displayName: req.user!.displayName,
            avatarUrl: req.user!.avatarUrl,
        },
    });
});

// PATCH /auth/profile — Update user profile (display name, avatar)
router.patch('/profile', authenticate, async (req: Request, res: Response) => {
    try {
        const { displayName, avatarUrl } = req.body;

        const updateData: Record<string, string> = {};
        if (displayName !== undefined) updateData.displayName = displayName;
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const [updated] = await db
            .update(schema.users)
            .set(updateData)
            .where(eq(schema.users.id, req.user!.id))
            .returning({
                id: schema.users.id,
                email: schema.users.email,
                role: schema.users.role,
                displayName: schema.users.displayName,
                avatarUrl: schema.users.avatarUrl,
            });

        return res.json({ user: updated });
    } catch (error) {
        console.error('Profile update error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
