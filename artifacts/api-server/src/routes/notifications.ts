import { Router } from "express";
import { db, notificationsTable } from "../../../../lib/db/src/index.js";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Ensure table exists on startup
db.execute(sql`
  CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    \`read\` BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`).catch((err: unknown) => {
  console.error("[notifications] Failed to ensure notifications table exists on boot:", err);
});

let tableInitialized = false;

router.get("/notifications", async (req, res) => {
  try {
    if (!tableInitialized) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          campaign_id INT,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          \`read\` BOOLEAN NOT NULL DEFAULT FALSE,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      tableInitialized = true;
      console.log("[notifications] Ensured notifications table exists.");
    }
    const notifications = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(50);
    res.json(notifications);
  } catch (error: any) {
    console.error("[notifications] Error fetching notifications:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/notifications/:id/read", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.id, id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("[notifications] Error updating notification:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/notifications/mark-all-read", async (req, res) => {
  try {
    await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.read, false));
    res.json({ success: true });
  } catch (error: any) {
    console.error("[notifications] Error updating notifications:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
