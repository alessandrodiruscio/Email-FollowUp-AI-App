import { mysqlTable, int, text, datetime } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const webhookLogsTable = mysqlTable("webhook_logs", {
  id: int("id").primaryKey().autoincrement(),
  payload: text("payload").notNull(),
  receivedAt: datetime("received_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  status: text("status"),
  error: text("error"),
});
