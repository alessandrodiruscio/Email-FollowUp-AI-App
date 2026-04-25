import { mysqlTable, int, text, varchar, datetime } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { recipientsTable } from "./recipients.js";
import { followUpStepsTable } from "./followUpSteps.js";

export const sentEmailsTable = mysqlTable("sent_emails", {
  id: int("id").primaryKey().autoincrement(),
  recipientId: int("recipient_id").notNull().references(() => recipientsTable.id, { onDelete: "cascade" }),
  followUpStepId: int("follow_up_step_id").references(() => followUpStepsTable.id, { onDelete: "set null" }),
  messageId: varchar("message_id", { length: 255 }), // Resend message ID for tracking
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sentAt: datetime("sent_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  status: text("status", { enum: ["sent", "failed"] }).notNull().default("sent"),
  stepNumber: int("step_number"),
});

export const insertSentEmailSchema = createInsertSchema(sentEmailsTable).omit({ id: true });
export type InsertSentEmail = z.infer<typeof insertSentEmailSchema>;
export type SentEmail = typeof sentEmailsTable.$inferSelect;
