import { Router } from "express";
import { db } from "@workspace/db";
import { sessions } from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthenticatedRequest } from "../middlewares/requireAuth";
import type { Request } from "express";
import { logger } from "../lib/logger";

const router = Router();

router.get("/sessions", requireAuth, async (req: Request, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt))
      .limit(100);
    res.json(rows);
  } catch (err) {
    logger.error({ err, userId }, "Failed to load sessions");
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

router.post("/sessions", requireAuth, async (req: Request, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { id, sessionDate, scenario, who, situation, response } = req.body as {
    id: string;
    sessionDate: string;
    scenario: string;
    who: string;
    situation?: string;
    response?: string;
  };

  if (!id || !scenario || !who) {
    res.status(400).json({ error: "id, scenario, and who are required" });
    return;
  }

  try {
    await db
      .insert(sessions)
      .values({
        id,
        userId,
        sessionDate: sessionDate ?? "",
        scenario,
        who,
        situation: situation ?? "",
        response: response ?? "",
      })
      .onConflictDoNothing();
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, userId }, "Failed to save session");
    res.status(500).json({ error: "Failed to save session" });
  }
});

router.patch("/sessions/:id", requireAuth, async (req: Request, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { id } = req.params as { id: string };
  const {
    scoresClarity,
    scoresComposure,
    scoresOutcome,
    debriefOutcome,
    debriefHappened,
    debriefDifferent,
    debriefText,
  } = req.body as {
    scoresClarity?: number;
    scoresComposure?: number;
    scoresOutcome?: number;
    debriefOutcome?: string;
    debriefHappened?: string;
    debriefDifferent?: string;
    debriefText?: string;
  };

  try {
    const updates: Partial<typeof sessions.$inferInsert> = {};
    if (scoresClarity !== undefined) updates.scoresClarity = scoresClarity;
    if (scoresComposure !== undefined)
      updates.scoresComposure = scoresComposure;
    if (scoresOutcome !== undefined) updates.scoresOutcome = scoresOutcome;
    if (debriefOutcome !== undefined) updates.debriefOutcome = debriefOutcome;
    if (debriefHappened !== undefined)
      updates.debriefHappened = debriefHappened;
    if (debriefDifferent !== undefined)
      updates.debriefDifferent = debriefDifferent;
    if (debriefText !== undefined) updates.debriefText = debriefText;

    if (Object.keys(updates).length === 0) {
      res.json({ success: true });
      return;
    }

    await db
      .update(sessions)
      .set(updates)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, userId, sessionId: id }, "Failed to update session");
    res.status(500).json({ error: "Failed to update session" });
  }
});

router.delete("/sessions/:id", requireAuth, async (req: Request, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { id } = req.params as { id: string };

  try {
    await db
      .delete(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, userId, sessionId: id }, "Failed to delete session");
    res.status(500).json({ error: "Failed to delete session" });
  }
});

export default router;
