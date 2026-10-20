import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { eq, and, desc } from "drizzle-orm";
import { authenticate } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();
router.use(authenticate);

const CreateAlertSchema = z
  .object({
    name: z.string().min(1).max(255),
    keywords: z.array(z.string().min(1)).min(1).max(50),
    email: z.string().email().optional().nullable(),
    slackWebhook: z.string().url().optional().nullable(),
    enabled: z.boolean().optional().default(true),
  })
  .refine((data) => !!data.email || !!data.slackWebhook, {
    message: "At least one of email or slackWebhook is required",
  });

const UpdateAlertSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  keywords: z.array(z.string().min(1)).min(1).max(50).optional(),
  email: z.string().email().nullable().optional(),
  slackWebhook: z.string().url().nullable().optional(),
  enabled: z.boolean().optional(),
});

// GET /alerts — list current user's alerts
router.get("/", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(schema.userAlerts)
      .where(eq(schema.userAlerts.userId, req.user!.id))
      .orderBy(desc(schema.userAlerts.createdAt));

    return res.json(
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    );
  } catch (error) {
    console.error("List alerts error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /alerts — create alert
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = CreateAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const [created] = await db
      .insert(schema.userAlerts)
      .values({
        userId: req.user!.id,
        name: parsed.data.name,
        keywords: parsed.data.keywords,
        email: parsed.data.email ?? null,
        slackWebhook: parsed.data.slackWebhook ?? null,
        enabled: parsed.data.enabled,
      })
      .returning();

    if (!created)
      return res.status(500).json({ error: "Failed to create alert" });

    return res.status(201).json({
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Create alert error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /alerts/:id — update alert
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = UpdateAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const [updated] = await db
      .update(schema.userAlerts)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.userAlerts.id, id as string),
          eq(schema.userAlerts.userId, req.user!.id),
        ),
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Alert not found" });

    return res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Update alert error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /alerts/:id — delete alert
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await db
      .delete(schema.userAlerts)
      .where(
        and(
          eq(schema.userAlerts.id, id as string),
          eq(schema.userAlerts.userId, req.user!.id),
        ),
      )
      .returning();

    if (!deleted.length)
      return res.status(404).json({ error: "Alert not found" });
    return res.status(204).send();
  } catch (error) {
    console.error("Delete alert error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
