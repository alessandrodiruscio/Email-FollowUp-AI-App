import { Router } from "express";
import { db, sentEmailsTable, emailEventsTable, recipientsTable, webhookLogsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

const router = Router();

// Test endpoint for Resend to verify path directly
router.post("/test", (req, res) => {
  console.log("[webhook-test] POST received");
  res.status(200).json({ status: "ok", received: true });
});

// Universal handler for webhooks
router.all("/", (req, res) => handleWebhook(req, res));
router.all("/resend", (req, res) => handleWebhook(req, res));
router.all("/resend/", (req, res) => handleWebhook(req, res));

async function handleWebhook(req: any, res: any) {
  const fullPath = req.baseUrl + req.url;
  console.log(`[webhook-router] Incoming! Method: ${req.method} | Path: ${fullPath} | Host: ${req.headers.host}`);
  
  // Respond immediately if it's GET/HEAD for manual verification
  if (req.method === "GET" || req.method === "HEAD") {
    return res.status(200).json({
      status: "active",
      message: "Webhook router is active and matched your request",
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  // Handle POST (the real webhook)
  if (req.method === "POST") {
    // Respond immediately to Svix/Resend to prevent "Attempting" (timeout)
    const response = res.status(200).json({ received: true });
    
    // Process in background
    (async () => {
      const payload = req.body;
      let logId: number | null = null;
      const rawPayload = typeof payload === 'object' ? JSON.stringify(payload) : String(payload || "");

    try {
      // 1. Log the raw payload
      try {
        const [insertResult] = await db.insert(webhookLogsTable).values({
          payload: rawPayload,
          status: "processing",
        });
        logId = (insertResult as any).insertId;
      } catch (logError: any) {
        if (logError.message && (logError.message.includes("webhook_logs") || logError.message.includes("does not exist"))) {
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS webhook_logs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              payload LONGTEXT NOT NULL,
              received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              status VARCHAR(50),
              error TEXT
            )
          `);
          const [retryResult] = await db.insert(webhookLogsTable).values({
            payload: rawPayload,
            status: "processing",
          });
          logId = (retryResult as any).insertId;
        }
      }
      
      if (!payload || Object.keys(payload).length === 0) {
        if (logId) await db.update(webhookLogsTable).set({ status: "error", error: "Empty payload" }).where(eq(webhookLogsTable.id, logId));
        return;
      }

      const type = payload.type;
      const data = payload.data || {};
      const emailId = data.email_id || data.id || payload.email_id || payload.id;
      
      if (!emailId) {
        if (logId) await db.update(webhookLogsTable).set({ status: "error", error: "Missing email ID" }).where(eq(webhookLogsTable.id, logId));
        return;
      }

      // Map Resend event types
      const eventTypeMap: Record<string, string> = {
        "email.sent": "sent",
        "email.delivered": "sent",
        "email.opened": "opened",
        "email.clicked": "clicked",
        "email.bounced": "bounced",
        "email.complained": "complained",
        "email.unsubscribed": "unsubscribed",
      };

      let eventType = type;
      if (type && eventTypeMap[type]) {
        eventType = eventTypeMap[type];
      } else if (!type) {
        eventType = "sent"; 
      }

      // Only process engagement events
      if (eventType !== "opened" && eventType !== "clicked" && eventType !== "sent") {
         if (logId) await db.update(webhookLogsTable).set({ status: "skipped", error: `Event ignored: ${eventType}` }).where(eq(webhookLogsTable.id, logId));
         return;
      }

      // Find sent email
      let [sentEmail] = await db
        .select()
        .from(sentEmailsTable)
        .where(eq(sentEmailsTable.messageId, emailId));

      // Fallback: recipient email
      if (!sentEmail && data.to) {
        const recipientEmail = Array.isArray(data.to) ? data.to[0] : data.to;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const results = await db
          .select()
          .from(sentEmailsTable)
          .leftJoin(recipientsTable, eq(sentEmailsTable.recipientId, recipientsTable.id))
          .where(and(
            eq(recipientsTable.email, recipientEmail),
            sql`${sentEmailsTable.sentAt} >= ${thirtyDaysAgo}`
          ))
          .orderBy(desc(sentEmailsTable.sentAt))
          .limit(1);
        
        if (results.length > 0) {
          sentEmail = (results[0] as any).sent_emails;
        }
      }

      if (!sentEmail) {
        if (logId) await db.update(webhookLogsTable).set({ status: "orphan", error: `No record for ${emailId}` }).where(eq(webhookLogsTable.id, logId));
        return;
      }

      const eventAt = payload.created_at ? new Date(payload.created_at) : new Date();

      // Store the event
      await db.insert(emailEventsTable).values({
        sentEmailId: sentEmail.id,
        messageId: emailId,
        eventType: eventType as any,
        timestamp: eventAt,
        metadata: rawPayload,
      });

      if (logId) await db.update(webhookLogsTable).set({ status: "success" }).where(eq(webhookLogsTable.id, logId));
      console.log(`[webhook] Processed ${eventType} for email ${sentEmail.id}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[webhook] Background error:", error);
      if (logId) {
        await db.update(webhookLogsTable)
          .set({ status: "failed", error: errorMsg })
          .where(eq(webhookLogsTable.id, logId))
          .catch((e: any) => console.error("Could not update final failure status", e));
      }
    }
    })();
    return response;
  }

  // Handle other methods
  return res.status(405).json({ error: "Method not allowed" });
}

export default router;
