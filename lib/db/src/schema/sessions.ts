import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessions = pgTable("tp_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  sessionDate: text("session_date").notNull().default(""),
  scenario: text("scenario").notNull().default(""),
  who: text("who").notNull().default(""),
  situation: text("situation").default(""),
  response: text("response").default(""),
  scoresClarity: integer("scores_clarity"),
  scoresComposure: integer("scores_composure"),
  scoresOutcome: integer("scores_outcome"),
  debriefOutcome: text("debrief_outcome"),
  debriefHappened: text("debrief_happened"),
  debriefDifferent: text("debrief_different"),
  debriefText: text("debrief_text"),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  createdAt: true,
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
