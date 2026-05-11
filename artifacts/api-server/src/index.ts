import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./lib/stripeClient";
import { Client } from "pg";

async function ensureStripeAccountsTable(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "stripe"."accounts" (
        "id"               text NOT NULL,
        "_raw_data"        jsonb NOT NULL,
        "first_synced_at"  timestamptz NOT NULL DEFAULT now(),
        "_last_synced_at"  timestamptz NOT NULL DEFAULT now(),
        "_updated_at"      timestamptz NOT NULL DEFAULT now(),
        "business_name"    text,
        "email"            text,
        "type"             text,
        "charges_enabled"  boolean,
        "payouts_enabled"  boolean,
        "details_submitted" boolean,
        "country"          text,
        "default_currency" text,
        "created"          integer,
        "api_key_hashes"   text[],
        PRIMARY KEY ("id")
      )
    `);
  } finally {
    await client.end();
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe init");
    return;
  }

  try {
    logger.info("Running Stripe migrations...");
    await runMigrations({ databaseUrl });
    await ensureStripeAccountsTable(databaseUrl);
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info("Stripe webhook configured");

    // Run backfill in background — don't block startup
    stripeSync
      .syncBackfill()
      .then(() => logger.info("Stripe data backfill complete"))
      .catch((err: unknown) => logger.error({ err }, "Stripe backfill error"));
  } catch (err: unknown) {
    logger.error({ err }, "Stripe init failed — payments unavailable");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Init Stripe in background, then start server
initStripe().finally(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});
