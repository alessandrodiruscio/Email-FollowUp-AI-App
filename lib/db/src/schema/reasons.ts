import { mysqlTable, int, text, boolean } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reasonsTable = mysqlTable("reasons", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366F1"),
  templateSubject: text("template_subject"),
  templateBody: text("template_body"),
  templateFromName: text("template_from_name"),
  templateFromEmail: text("template_from_email"),
  templateIncludeFooter: boolean("template_include_footer").default(true),
});

export const insertReasonSchema = createInsertSchema(reasonsTable).omit({ id: true });
export type InsertReason = z.infer<typeof insertReasonSchema>;
export type Reason = typeof reasonsTable.$inferSelect;
