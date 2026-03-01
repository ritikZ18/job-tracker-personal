import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

// GET /analytics/funnel — application funnel + response metrics for current user
router.get("/funnel", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const funnelResult = await db.execute(sql`
            SELECT
              COUNT(*) FILTER (WHERE status = 'SAVED')::int        AS saved,
              COUNT(*) FILTER (WHERE status = 'APPLIED')::int      AS applied,
              COUNT(*) FILTER (WHERE status = 'INTERVIEWING')::int AS interviewing,
              COUNT(*) FILTER (WHERE status = 'OFFER')::int        AS offers,
              COUNT(*) FILTER (WHERE status = 'REJECTED')::int     AS rejected,
              COUNT(*) FILTER (WHERE status = 'GHOSTED')::int      AS ghosted,
              COUNT(*)::int                                        AS total,
              ROUND(
                COUNT(*) FILTER (WHERE status IN ('INTERVIEWING','OFFER','REJECTED'))
                * 100.0 / NULLIF(COUNT(*) FILTER (WHERE applied_at IS NOT NULL), 0), 1
              ) AS response_rate_pct,
              ROUND(
                COUNT(*) FILTER (WHERE status = 'OFFER')
                * 100.0 / NULLIF(COUNT(*) FILTER (WHERE applied_at IS NOT NULL), 0), 1
              ) AS offer_rate_pct,
              ROUND(AVG(
                EXTRACT(EPOCH FROM (
                  LEAST(
                    COALESCE(interviewing_at, 'infinity'::timestamptz),
                    COALESCE(offer_at,        'infinity'::timestamptz),
                    COALESCE(rejected_at,     'infinity'::timestamptz)
                  ) - applied_at
                )) / 86400
              ) FILTER (
                WHERE applied_at IS NOT NULL
                  AND COALESCE(interviewing_at, offer_at, rejected_at) IS NOT NULL
              ), 1) AS avg_days_to_response
            FROM applications
            WHERE user_id = ${userId}
        `);

    const velocityResult = await db.execute(sql`
            SELECT
              DATE_TRUNC('week', applied_at)::date AS week,
              COUNT(*)::int AS applications
            FROM applications
            WHERE user_id = ${userId}
              AND applied_at IS NOT NULL
              AND applied_at > NOW() - INTERVAL '12 weeks'
            GROUP BY 1
            ORDER BY 1
        `);

    const sourceResult = await db.execute(sql`
            SELECT source, COUNT(*)::int AS count
            FROM applications
            WHERE user_id = ${userId}
            GROUP BY source
            ORDER BY count DESC
        `);

    const funnel = (funnelResult.rows[0] as Record<string, unknown>) || {};

    return res.json({
      funnel: {
        saved: funnel.saved || 0,
        applied: funnel.applied || 0,
        interviewing: funnel.interviewing || 0,
        offers: funnel.offers || 0,
        rejected: funnel.rejected || 0,
        ghosted: funnel.ghosted || 0,
        total: funnel.total || 0,
      },
      metrics: {
        responseRatePct: funnel.response_rate_pct ?? null,
        offerRatePct: funnel.offer_rate_pct ?? null,
        avgDaysToResponse: funnel.avg_days_to_response ?? null,
      },
      weeklyVelocity: velocityResult.rows,
      bySource: sourceResult.rows,
    });
  } catch (error) {
    console.error("Funnel analytics error:", error);
    return res
      .status(500)
      .json({ error: "Failed to compute funnel analytics" });
  }
});

export default router;
