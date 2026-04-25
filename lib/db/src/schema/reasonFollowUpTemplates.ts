import { mysqlTable, int, text, boolean } from "drizzle-orm/mysql-core";
import { reasonsTable } from "./reasons.js";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reasonFollowUpTemplatesTable = mysqlTable("reason_follow_up_templates", {
  id: int("id").primaryKey().autoincrement(),
  reasonId: int("reason_id").notNull().references(() => reasonsTable.id, { onDelete: "cascade" }),
  stepNumber: int("step_number").notNull(),
  delayValue: int("delay_value").notNull().default(3),
  delayUnit: text("delay_unit").notNull().default("days"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  includeFooter: boolean("include_footer").notNull().default(true),
});

export const insertReasonFollowUpTemplateSchema = createInsertSchema(reasonFollowUpTemplatesTable).omit({ id: true });
export type InsertReasonFollowUpTemplate = z.infer<typeof insertReasonFollowUpTemplateSchema>;
export type ReasonFollowUpTemplate = typeof reasonFollowUpTemplatesTable.$inferSelect;
