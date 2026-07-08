import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const proOverrides = pgTable("tp_pro_overrides", {
  userId: text("user_id").primaryKey(),
  grantedAt: timestamp("granted_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  note: text("note").default("").notNull(),
});

export type ProOverride = typeof proOverrides.$inferSelect;
