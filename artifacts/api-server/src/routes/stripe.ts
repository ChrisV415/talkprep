import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthenticatedRequest } from "../middlewares/requireAuth";
import type { Request, Response } from "express";
import { storage } from "../lib/storage";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient";
import { logger } from "../lib/logger";

const router = Router();

router.get("/stripe/publishable-key", async (_req: Request, res: Response) => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (err) {
    logger.error({ err }, "Failed to get publishable key");
    res.status(500).json({ error: "Stripe not configured" });
  }
});

router.get("/stripe/products", async (_req: Request, res: Response) => {
  try {
    const products = await storage.listProductsWithPrices();
    res.json({ data: products });
  } catch (err) {
    logger.error({ err }, "Failed to list products");
    res.status(500).json({ error: "Failed to load products" });
  }
});

router.get("/stripe/subscription", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const sub = await storage.getActiveSubscription(userId);
    res.json({ subscription: sub });
  } catch (err) {
    logger.error({ err }, "Failed to get subscription");
    res.status(500).json({ error: "Failed to load subscription" });
  }
});

router.post("/stripe/checkout", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { priceId, email } = req.body as {
    priceId: string;
    email?: string;
  };

  if (!priceId) {
    res.status(400).json({ error: "priceId is required" });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    let user = await storage.getUser(userId);

    if (!user) {
      user = await storage.upsertUser(userId, email);
    }

    let customerId = user.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        metadata: { userId },
      });
      await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Failed to create checkout session");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/stripe/portal", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;

  try {
    const user = await storage.getUser(userId);
    if (!user?.stripeCustomerId) {
      res.status(404).json({ error: "No billing account found" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: baseUrl,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    logger.error({ err }, "Failed to create portal session");
    res.status(500).json({ error: "Failed to open billing portal" });
  }
});

export default router;
