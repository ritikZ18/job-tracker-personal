import { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

export interface AuthUser {
    id: string;
    email: string;
    role: 'USER' | 'ADMIN';
    supabaseUid: string;
    displayName: string | null;
    avatarUrl: string | null;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

/** Check if Supabase is configured */
function isSupabaseConfigured(): boolean {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // DEV MODE: If Supabase is not configured, use a mock dev user
        if (!isSupabaseConfigured()) {
            // Ensure a dev user exists in DB
            let [devUser] = await db
                .select({
                    id: schema.users.id,
                    email: schema.users.email,
                    role: schema.users.role,
                    supabaseUid: schema.users.supabaseUid,
                    displayName: schema.users.displayName,
                    avatarUrl: schema.users.avatarUrl,
                })
                .from(schema.users)
                .where(eq(schema.users.supabaseUid, 'dev-user'))
                .limit(1);

            if (!devUser) {
                const [created] = await db
                    .insert(schema.users)
                    .values({
                        supabaseUid: 'dev-user',
                        email: 'dev@careercrawl.local',
                        displayName: 'Dev User',
                        role: 'ADMIN',
                    })
                    .returning({
                        id: schema.users.id,
                        email: schema.users.email,
                        role: schema.users.role,
                        supabaseUid: schema.users.supabaseUid,
                        displayName: schema.users.displayName,
                        avatarUrl: schema.users.avatarUrl,
                    });
                devUser = created;
            }

            req.user = devUser;
            return next();
        }

        // PRODUCTION: Verify Supabase JWT
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.slice(7);
        const supabaseAdmin = getSupabaseAdmin();

        const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !supabaseUser) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        let [user] = await db
            .select({
                id: schema.users.id,
                email: schema.users.email,
                role: schema.users.role,
                supabaseUid: schema.users.supabaseUid,
                displayName: schema.users.displayName,
                avatarUrl: schema.users.avatarUrl,
            })
            .from(schema.users)
            .where(eq(schema.users.supabaseUid, supabaseUser.id))
            .limit(1);

        if (!user) {
            const [newUser] = await db
                .insert(schema.users)
                .values({
                    supabaseUid: supabaseUser.id,
                    email: supabaseUser.email || '',
                    displayName: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || null,
                    avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
                })
                .returning({
                    id: schema.users.id,
                    email: schema.users.email,
                    role: schema.users.role,
                    supabaseUid: schema.users.supabaseUid,
                    displayName: schema.users.displayName,
                    avatarUrl: schema.users.avatarUrl,
                });
            user = newUser;
        }

        req.user = user;
        next();
    } catch (error: any) {
        console.error('Auth middleware error:', error);
        const message = process.env.NODE_ENV === 'production'
            ? 'Authentication failed'
            : `Authentication failed: ${error.message || error}`;
        return res.status(401).json({ error: message });
    }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};
