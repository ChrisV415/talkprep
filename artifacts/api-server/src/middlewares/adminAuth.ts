import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-admin-token"] as string | undefined;
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    res.status(503).json({ error: "Admin panel not configured — set ADMIN_PASSWORD secret" });
    return;
  }

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Use hash comparison so timingSafeEqual works regardless of length differences
  const a = crypto.createHash("sha256").update(token).digest();
  const b = crypto.createHash("sha256").update(password).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
