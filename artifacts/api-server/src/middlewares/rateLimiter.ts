import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usageCounts } from "@workspace/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { AuthenticatedRequest } from "./requireAuth";
import { storage } from "../lib/storage";

// Each free user gets exactly 1 lifetime prep generation.
const FREE_PREP_LIMIT = 1;
const ALL_TIME_PERIOD = "all-time";

export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) {
    next();
    return;
  }

  // Pro subscribers have unlimited access
  try {
    const isPro = await storage.isProUser(userId);
    if (isPro) {
      next();
      return;
    }
  } catch {
    // If subscription check fails, fall through to count-based limit
  }

  try {
    const result = await db
      .insert(usageCounts)
      .values({ userId, period: ALL_TIME_PERIOD, aiCalls: 1 })
      .onConflictDoUpdate({
        target: [usageCounts.userId, usageCounts.period],
        set: { aiCalls: sql`${usageCounts.aiCalls} + 1` },
      })
      .returning({ aiCalls: usageCounts.aiCalls });

    const current = result[0]?.aiCalls ?? 1;

    if (current > FREE_PREP_LIMIT) {
      // Roll back the increment so the count stays accurate
      await db
        .update(usageCounts)
        .set({ aiCalls: sql`${usageCounts.aiCalls} - 1` })
        .where(
          and(
            eq(usageCounts.userId, userId),
            eq(usageCounts.period, ALL_TIME_PERIOD),
          ),
        );

      res.status(429).json({
        error: "Free prep used",
        message:
          "You've used your free prep. Upgrade to Pro for unlimited access.",
        upgrade: true,
      });
      return;
    }

    next();
  } catch {
    // On DB error, allow through rather than blocking the user
    next();
  }
}
