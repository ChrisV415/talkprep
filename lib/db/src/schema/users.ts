import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("tp_users", {
  id: text("id").primaryKey(),
  email: text("email"),
  phone: text("phone"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
