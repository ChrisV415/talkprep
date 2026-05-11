import Stripe from "stripe";

async function getStripeCredentials(): Promise<{
  secretKey: string;
  publishableKey?: string;
}> {
  // Prefer explicit secrets when set (live keys for production)
  const envSecret = process.env.STRIPE_SECRET_KEY;
  const envPublishable = process.env.STRIPE_PUBLISHABLE_KEY;
  if (envSecret) {
    return { secretKey: envSecret, publishableKey: envPublishable };
  }

  // Fall back to Replit connectors (test keys in development)
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Stripe not configured: set STRIPE_SECRET_KEY or connect via Replit integrations");
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe&environment=${targetEnvironment}`,
    {
      headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status}`);
  }

  const data = (await resp.json()) as {
    items?: { settings: { secret?: string; publishable?: string } }[];
  };
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    secretKey: settings.secret,
    publishableKey: settings.publishable,
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getStripeCredentials();
  if (!publishableKey) throw new Error("Stripe publishable key not found");
  return publishableKey;
}
