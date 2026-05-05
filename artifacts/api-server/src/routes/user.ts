import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthenticatedRequest } from "../middlewares/requireAuth";
import type { Request, Response } from "express";
import { storage } from "../lib/storage";

const router = Router();

router.get("/user/me", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const user = await storage.getUser(userId);
  res.json({ user });
});

router.post("/user/phone", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { phone } = req.body as { phone: string };
  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }
  try {
    const user = await storage.upsertUser(userId);
    await storage.savePhone(userId, phone);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save phone number" });
  }
});

export default router;
