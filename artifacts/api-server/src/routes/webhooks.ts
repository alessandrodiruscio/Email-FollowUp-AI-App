import { Router } from "express";
import { db, sentEmailsTable, emailEventsTable, recipientsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

const router = Router();

// Test endpoint to verify webhook route is accessible
router.get("/resend", (req, res) => {
  console.log(`[webhook] GET /webhooks/resend - Webhook endpoint is accessible!`);
  res.json({ message: "Webhook endpoint is accessible", timestamp: new Date().toISOString() });
});

interface ResendWebhookPayload {
  type: "email.sent" | "email.opened" | "email.clicked" | "email.bounced" | "email.complained" | "email.unsubscribed";
  created_at: string;
  data: {
    email_id: string; // This is the messageId
    from?: string;
    to?: string;
    [key: string]: any;
  };
}

router.post("/resend", async (req, res) => {
  console.log(`[webhook] POST /resend handler called`);
  try {
    console.log(`[webhook] Raw request received at /webhooks/resend`);
    console.log(`[webhook] Body type:`, typeof req.body);
    console.log(`[webhook] Body keys:`, Object.keys(req.body || {}));
    
    const payload: ResendWebhookPayload = req.body;
    
    console.log(`[webhook] Payload type: ${payload.type}`);
    console.log(`[webhook] Received Resend event: ${payload.type} for message ${payload.data?.email_id}`);

    // Try to find the sent email by messageId first
    let [sentEmail] = await db
      .select()
      .from(sentEmailsTable)
      .where(eq(sentEmailsTable.messageId, payload.data.email_id));

    // If not found by messageId, try to find by recipient email + most recent sent email
    // BUT only match emails sent within the last 30 days to avoid false positives
    if (!sentEmail && payload.data.to) {
      const recipientEmail = Array.isArray(payload.data.to) ? payload.data.to[0] : payload.data.to;
      console.log(`[webhook] Message ID not found, looking up by recipient email: ${recipientEmail}`);
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const sentEmails = await db
        .select()
        .from(sentEmailsTable)
        .leftJoin(recipientsTable, eq(sentEmailsTable.recipientId, recipientsTable.id))
        .where(and(
          eq(recipientsTable.email, recipientEmail),
          sql`${sentEmailsTable.sentAt} >= ${thirtyDaysAgo}`,
          eq(sentEmailsTable.status, "sent")
        ))
        .orderBy(desc(sentEmailsTable.sentAt))
        .limit(1);
      
      if (sentEmails.length > 0) {
        sentEmail = sentEmails[0].sent_emails;
        console.log(`[webhook] Found sent email by recipient fallback: sentEmailId=${sentEmail.id}, sentAt=${sentEmail.sentAt}`);
      }
    }

    if (!sentEmail) {
      console.warn(`[webhook] Could not find sent email for message ${payload.data.email_id} or recipient ${payload.data.to}`);
      return res.status(404).json({ error: "Message not found" });
    }

    // Map Resend event types to our event types
    const eventTypeMap: Record<string, string> = {
      "email.sent": "sent",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.unsubscribed": "unsubscribed",
    };

    const eventType = eventTypeMap[payload.type] || payload.type;
    const timestamp = new Date(payload.created_at);

    // Store the event in the database
    await db.insert(emailEventsTable).values({
      sentEmailId: sentEmail.id,
      messageId: payload.data.email_id,
      eventType: eventType as any,
      timestamp,
      metadata: JSON.stringify(payload.data),
    });

    console.log(
      `[webhook] Stored ${eventType} event for message ${payload.data.email_id}`
    );

    res.json({ success: true });
  } catch (error) {
    console.error("[webhook] Error processing Resend webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
