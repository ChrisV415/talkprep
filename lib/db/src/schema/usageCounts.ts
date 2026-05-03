import { integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const usageCounts = pgTable(
  "usage_counts",
  {
    userId: text("user_id").notNull(),
    period: text("period").notNull(),
    aiCalls: integer("ai_calls").default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.period] })],
);

export type UsageCount = typeof usageCounts.$inferSelect;
