import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { LoginSchema, RegisterSchema } from '@repo/types';
import { JWT_SECRET, authenticate } from '../middleware/auth.js';

const router = Router();

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
    try {
        const parsed = RegisterSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
        }

        const { email, password } = parsed.data;

        // Check if user exists
        const existing = await db
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.email, email))
            .limit(1);

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const [user] = await db
            .insert(schema.users)
            .values({ email, passwordHash })
            .returning({
                id: schema.users.id,
                email: schema.users.email,
                role: schema.users.role,
                createdAt: schema.users.createdAt,
            });

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(201).json({
            user: { ...user, createdAt: user.createdAt.toISOString() },
            token,
        });
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
    try {
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
        }

        const { email, password } = parsed.data;

        const [user] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, email))
            .limit(1);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt.toISOString(),
            },
            token,
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /auth/logout
router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie('token');
    return res.json({ message: 'Logged out' });
});

// GET /auth/me
router.get('/me', authenticate, (req: Request, res: Response) => {
    return res.json({ user: req.user });
});

export default router;
