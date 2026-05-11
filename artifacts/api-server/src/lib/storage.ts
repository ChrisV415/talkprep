import { db } from "@workspace/db";
import { users, proOverrides } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "./stripeClient";

type ProductWithPrices = {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: {
    id: string;
    unit_amount: number;
    currency: string;
    recurring: { interval: string } | null;
  }[];
};

const PLAN_ORDER = ["Single Session", "Monthly Pro", "Annual Pro"];

export class Storage {
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ?? null;
  }

  async upsertUser(id: string, email?: string) {
    const [user] = await db
      .insert(users)
      .values({ id, email: email ?? null })
      .onConflictDoUpdate({
        target: users.id,
        set: { email: email ?? null },
      })
      .returning();
    return user;
  }

  async savePhone(userId: string, phone: string) {
    const [user] = await db
      .update(users)
      .set({ phone })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserStripeInfo(
    userId: string,
    stripeInfo: { stripeCustomerId?: string; stripeSubscriptionId?: string },
  ) {
    const [user] = await db
      .update(users)
      .set(stripeInfo)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Always use the Stripe API directly — no dependency on local stripe.* tables
  async getActiveSubscription(userId: string) {
    const user = await this.getUser(userId);
    if (!user?.stripeSubscriptionId) return null;
    try {
      const stripe = await getUncachableStripeClient();
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      return { id: sub.id, status: sub.status };
    } catch {
      return null;
    }
  }

  async isProUser(userId: string): Promise<boolean> {
    // Manual admin override takes priority
    try {
      const [override] = await db
        .select()
        .from(proOverrides)
        .where(eq(proOverrides.userId, userId));
      if (override) return true;
    } catch {
      // table may not exist yet; fall through
    }
    const sub = await this.getActiveSubscription(userId);
    if (!sub) return false;
    return sub.status === "active" || sub.status === "trialing";
  }

  async grantProOverride(userId: string, note = ""): Promise<void> {
    await db
      .insert(proOverrides)
      .values({ userId, note })
      .onConflictDoUpdate({ target: proOverrides.userId, set: { note } });
  }

  async revokeProOverride(userId: string): Promise<void> {
    await db.delete(proOverrides).where(eq(proOverrides.userId, userId));
  }

  async getUserByStripeCustomerId(customerId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId));
    return user ?? null;
  }

  async hasProOverride(userId: string): Promise<boolean> {
    const [row] = await db
      .select()
      .from(proOverrides)
      .where(eq(proOverrides.userId, userId));
    return !!row;
  }

  async listProductsWithPrices(): Promise<ProductWithPrices[]> {
    // Always use the Stripe API directly — fast, accurate, no local table dependency
    return this._listFromStripeApi();
  }

  private async _listFromStripeApi(): Promise<ProductWithPrices[]> {
    const stripe = await getUncachableStripeClient();
    const [productsRes, pricesRes] = await Promise.all([
      stripe.products.list({ active: true, limit: 20 }),
      stripe.prices.list({ active: true, limit: 50 }),
    ]);

    const pricesByProduct = new Map<string, ProductWithPrices["prices"]>();
    for (const price of pricesRes.data) {
      const pid = typeof price.product === "string" ? price.product : price.product.id;
      if (!pricesByProduct.has(pid)) pricesByProduct.set(pid, []);
      pricesByProduct.get(pid)!.push({
        id: price.id,
        unit_amount: price.unit_amount ?? 0,
        currency: price.currency,
        recurring: price.recurring ? { interval: price.recurring.interval } : null,
      });
    }

    const products: ProductWithPrices[] = productsRes.data.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      metadata: (p.metadata as Record<string, string>) ?? {},
      prices: (pricesByProduct.get(p.id) ?? []).sort((a, b) => a.unit_amount - b.unit_amount),
    }));

    return this._sortProducts(products);
  }

  private _sortProducts(products: ProductWithPrices[]): ProductWithPrices[] {
    return products.sort((a, b) => {
      const ai = PLAN_ORDER.indexOf(a.name);
      const bi = PLAN_ORDER.indexOf(b.name);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
}

export const storage = new Storage();
