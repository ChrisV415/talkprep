import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usageCounts } from "@workspace/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { AuthenticatedRequest } from "./requireAuth";

const FREE_TIER_LIMIT = 20;

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

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

  const period = getCurrentPeriod();

  try {
    const result = await db
      .insert(usageCounts)
      .values({ userId, period, aiCalls: 1 })
      .onConflictDoUpdate({
        target: [usageCounts.userId, usageCounts.period],
        set: { aiCalls: sql`${usageCounts.aiCalls} + 1` },
      })
      .returning({ aiCalls: usageCounts.aiCalls });

    const current = result[0]?.aiCalls ?? 1;

    if (current > FREE_TIER_LIMIT) {
      await db
        .update(usageCounts)
        .set({ aiCalls: sql`${usageCounts.aiCalls} - 1` })
        .where(
          and(eq(usageCounts.userId, userId), eq(usageCounts.period, period)),
        );

      res.status(429).json({
        error: "Monthly AI limit reached",
        message: `You've used all ${FREE_TIER_LIMIT} free AI calls for this month. Upgrade to Pro for unlimited access.`,
        limit: FREE_TIER_LIMIT,
        period,
      });
      return;
    }

    next();
  } catch (err) {
    next();
  }
}
