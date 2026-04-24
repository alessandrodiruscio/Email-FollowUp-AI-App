import { mysqlTable, int, text, varchar, datetime } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sentEmailsTable } from "./sentEmails";

export const emailEventsTable = mysqlTable("email_events", {
  id: int("id").primaryKey().autoincrement(),
  sentEmailId: int("sent_email_id").notNull().references(() => sentEmailsTable.id, { onDelete: "cascade" }),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  eventType: text("event_type", { enum: ["sent", "opened", "clicked", "bounced", "complained", "unsubscribed"] }).notNull(),
  timestamp: datetime("timestamp", { mode: "date" }).notNull(),
  metadata: text("metadata"), // JSON string for additional event data
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertEmailEventSchema = createInsertSchema(emailEventsTable).omit({ id: true, createdAt: true });
export type InsertEmailEvent = z.infer<typeof insertEmailEventSchema>;
export type EmailEvent = typeof emailEventsTable.$inferSelect;
