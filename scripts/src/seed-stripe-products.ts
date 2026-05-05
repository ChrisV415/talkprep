/**
 * Creates TalkPrep products and prices in Stripe.
 * Safe to run multiple times — checks for existing products first.
 *
 * Run with: pnpm --filter @workspace/scripts exec tsx src/seed-stripe-products.ts
 */

import Stripe from "stripe";

async function getStripeClient(): Promise<Stripe> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : null;

  if (!hostname || !xReplitToken) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("No Stripe credentials found");
    return new Stripe(key, { apiVersion: "2026-04-22.dahlia" as any });
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe&environment=development`,
    { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } },
  );
  const data = await resp.json() as { items?: { settings: { secret?: string } }[] };
  const secretKey = data.items?.[0]?.settings?.secret;
  if (!secretKey) throw new Error("Stripe development connection not found");
  return new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" as any });
}

async function seedProducts() {
  const stripe = await getStripeClient();
  console.log("Connected to Stripe\n");

  const plans = [
    {
      name: "Single Session",
      description: "Full prep guide, opening script + 3 response handlers, persona setup + role-play, annotated transcript review, post-conversation debrief.",
      prices: [
        { amount: 499, currency: "usd", interval: null, nickname: "Single Session" },
      ],
      metadata: { plan: "single", highlight: "PAY AS YOU GO" },
    },
    {
      name: "Monthly Pro",
      description: "Unlimited conversations, full conversation history, progress dashboard + score tracking, Curveballs mode + persona depth, live strategy nudges, session sharing links.",
      prices: [
        { amount: 1299, currency: "usd", interval: "month" as const, nickname: "Monthly Pro" },
      ],
      metadata: { plan: "monthly", highlight: "MOST POPULAR" },
    },
    {
      name: "Annual Pro",
      description: "Everything in Monthly, save 49% vs monthly, export conversation history, priority response speed.",
      prices: [
        { amount: 7900, currency: "usd", interval: "year" as const, nickname: "Annual Pro" },
      ],
      metadata: { plan: "annual", highlight: "BEST VALUE" },
    },
  ];

  for (const plan of plans) {
    const existing = await stripe.products.search({
      query: `name:'${plan.name}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      const product = existing.data[0];
      console.log(`✓ ${plan.name} already exists (${product.id})`);
      const prices = await stripe.prices.list({ product: product.id, active: true });
      prices.data.forEach((p) =>
        console.log(`  price: $${(p.unit_amount ?? 0) / 100}${p.recurring ? `/${p.recurring.interval}` : ""} (${p.id})`),
      );
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: plan.metadata,
    });
    console.log(`Created product: ${product.name} (${product.id})`);

    for (const price of plan.prices) {
      const created = await stripe.prices.create({
        product: product.id,
        unit_amount: price.amount,
        currency: price.currency,
        nickname: price.nickname,
        ...(price.interval ? { recurring: { interval: price.interval } } : {}),
      });
      console.log(
        `  Created price: $${price.amount / 100}${price.interval ? `/${price.interval}` : " one-time"} (${created.id})`,
      );
    }
  }

  console.log("\nDone! Products are in Stripe and will sync to the database via webhook.");
}

seedProducts().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
