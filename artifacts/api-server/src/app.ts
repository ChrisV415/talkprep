import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import { handleStripeEvent } from "./lib/webhookHandlers";
import { getUncachableStripeClient } from "./lib/stripeClient";
import router from "./routes";
import { logger } from "./lib/logger";
import type Stripe from "stripe";

const app: Express = express();

// Stripe webhook MUST be registered before express.json() to receive raw Buffer
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: "Invalid webhook request" });
      return;
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      const stripe = await getUncachableStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event: Stripe.Event;
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          sig,
          webhookSecret,
        );
      } else {
        logger.warn(
          "STRIPE_WEBHOOK_SECRET not set — skipping signature verification",
        );
        event = JSON.parse((req.body as Buffer).toString()) as Stripe.Event;
      }

      await handleStripeEvent(event);
      res.status(200).json({ received: true });
    } catch (err: unknown) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const allowedOrigins: (string | RegExp)[] = [
  /\.replit\.dev$/,
  /\.replit\.app$/,
  /^https?:\/\/localhost(:\d+)?$/,
];
if (process.env.REPLIT_DOMAINS) {
  process.env.REPLIT_DOMAINS.split(",").forEach((d) =>
    allowedOrigins.push(`https://${d.trim()}`),
  );
}
app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const ok = allowedOrigins.some((p) =>
        typeof p === "string" ? p === origin : p.test(origin),
      );
      cb(ok ? null : new Error("CORS: origin not allowed"), ok);
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const productionDomain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    ...(productionDomain
      ? { proxyUrl: `https://${productionDomain}/api/__clerk` }
      : {}),
  }),
);

app.use("/api", router);

export default app;
