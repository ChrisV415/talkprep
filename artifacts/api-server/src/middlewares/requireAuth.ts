import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { storage } from "../lib/storage";

export interface AuthenticatedRequest extends Request {
  userId: string;
}

// In-process cache — avoids repeated Clerk API calls for the same user
const emailCaptured = new Set<string>();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthenticatedRequest).userId = userId;

  // Non-blocking: capture email once per server lifetime per user
  if (!emailCaptured.has(userId)) {
    emailCaptured.add(userId);
    captureUserEmail(userId).catch(() => {});
  }

  next();
}

async function captureUserEmail(userId: string) {
  try {
    const existing = await storage.getUser(userId);
    if (existing?.email) return; // already stored

    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? undefined;
    await storage.upsertUser(userId, email);
  } catch {
    // Non-fatal — auth still works, admin just won't show email
  }
}
