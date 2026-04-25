import { mysqlTable, int, text, varchar, boolean, datetime } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns.js";

export const followUpStepsTable = mysqlTable("follow_up_steps", {
  id: int("id").primaryKey().autoincrement(),
  campaignId: int("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  stepNumber: int("step_number").notNull(),
  delayValue: int("delay_value").notNull(),
  delayUnit: varchar("delay_unit", { length: 10 }).notNull().default("days"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  includeFooter: boolean("include_footer").notNull().default(true),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertFollowUpStepSchema = createInsertSchema(followUpStepsTable).omit({ id: true, createdAt: true });
export type InsertFollowUpStep = z.infer<typeof insertFollowUpStepSchema>;
export type FollowUpStep = typeof followUpStepsTable.$inferSelect;
