import { mysqlTable, int, text, boolean, datetime } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reasonsTable } from "./reasons.js";

export const campaignsTable = mysqlTable("campaigns", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  status: text("status", { enum: ["draft", "active", "paused", "completed"] }).notNull().default("draft"),
  emailFontSize: text("email_font_size").default("16"),
  emailFontFamily: text("email_font_family").default("sans-serif"),
  emailLineHeight: text("email_line_height").default("1.6"),
  footerName: text("footer_name"),
  footerTitle: text("footer_title"),
  footerImageUrl: text("footer_image_url"),
  footerWebsite: text("footer_website"),
  footerWebsiteUrl: text("footer_website_url"),
  footerFacebook: text("footer_facebook"),
  footerInstagram: text("footer_instagram"),
  footerYoutube: text("footer_youtube"),
  reasonId: int("reason_id").references(() => reasonsTable.id, { onDelete: "set null" }),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
