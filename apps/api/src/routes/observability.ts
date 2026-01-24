import { Router, Request, Response } from 'express';
import { db, schema } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public health check
router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected observability endpoint (admin only)
router.get('/stats', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
        // Get counts
        const [userCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.users);

        const [appCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.applications);

        const analysisStatsResult = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'PENDING')::int as pending,
        COUNT(*) FILTER (WHERE status = 'RUNNING')::int as running,
        COUNT(*) FILTER (WHERE status = 'DONE')::int as done,
        COUNT(*) FILTER (WHERE status = 'FAILED')::int as failed,
        COUNT(*)::int as total
      FROM job_analyses
    `);
        const analysisStats = analysisStatsResult.rows[0] as any;

        const statusDistResult = await db.execute(sql`
      SELECT 
        status,
        COUNT(*)::int as count
      FROM applications
      GROUP BY status
      ORDER BY count DESC
    `);
        const statusDistribution = statusDistResult.rows;

        // Recent activity (last 24 hours)
        const recentAppsResult = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM applications
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);
        const recentApps = recentAppsResult.rows[0] as any;

        const recentAnalysesResult = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM job_analyses
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);
        const recentAnalyses = recentAnalysesResult.rows[0] as any;

        return res.json({
            timestamp: new Date().toISOString(),
            users: {
                total: userCount?.count || 0,
            },
            applications: {
                total: appCount?.count || 0,
                last24h: (recentApps as any)?.count || 0,
                byStatus: statusDistribution || [],
            },
            jobAnalyses: {
                pending: (analysisStats as any)?.pending || 0,
                running: (analysisStats as any)?.running || 0,
                done: (analysisStats as any)?.done || 0,
                failed: (analysisStats as any)?.failed || 0,
                total: (analysisStats as any)?.total || 0,
                last24h: (recentAnalyses as any)?.count || 0,
                successRate: (analysisStats as any)?.total
                    ? (((analysisStats as any)?.done / (analysisStats as any)?.total) * 100).toFixed(1) + '%'
                    : 'N/A',
            },
            system: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version,
            },
        });
    } catch (error) {
        console.error('Observability error:', error);
        return res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Error logging endpoint
router.post('/log', authenticate, async (req: Request, res: Response) => {
    try {
        const { level, message, context } = req.body;

        // Log to console (in production, you'd send to a logging service)
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level || 'error',
            message,
            userId: req.user?.id,
            context,
        };

        console.log('[CLIENT LOG]', JSON.stringify(logEntry));

        return res.json({ logged: true });
    } catch (error) {
        console.error('Logging error:', error);
        return res.status(500).json({ error: 'Failed to log' });
    }
});

export default router;
