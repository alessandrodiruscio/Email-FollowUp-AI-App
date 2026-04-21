import { mysqlTable, int, text, boolean, datetime } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";

export const recipientsTable = mysqlTable("recipients", {
  id: int("id").primaryKey().autoincrement(),
  campaignId: int("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name").notNull(),
  company: text("company"),
  replied: boolean("replied").notNull().default(false),
  initialSentAt: datetime("initial_sent_at", { mode: "date" }),
  repliedAt: datetime("replied_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertRecipientSchema = createInsertSchema(recipientsTable).omit({ id: true, createdAt: true });
export type InsertRecipient = z.infer<typeof insertRecipientSchema>;
export type Recipient = typeof recipientsTable.$inferSelect;
