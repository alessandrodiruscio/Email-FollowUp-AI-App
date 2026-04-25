import { Router } from "express";
import { db, sentEmailsTable, emailEventsTable, recipientsTable } from "../../../../lib/db/src/index";
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
    
    const payload: any = req.body;
    
    // Resend webhooks can have nested data or be direct payloads depending on version/type
    const type = payload.type;
    const data = payload.data || {};
    const emailId = data.email_id || data.id || payload.email_id || payload.id;
    
    console.log(`[webhook] Payload details:`, JSON.stringify(payload));
    console.log(`[webhook] Payload type: ${type}`);
    console.log(`[webhook] Received Resend event: ${type} for message ${emailId}`);

    if (!emailId) {
      console.warn(`[webhook] Missing email ID in payload:`, JSON.stringify(payload).substring(0, 500));
      return res.status(400).json({ error: "Missing email ID" });
    }

    // Try to find the sent email by messageId first
    let [sentEmail] = await db
      .select()
      .from(sentEmailsTable)
      .where(eq(sentEmailsTable.messageId, emailId));

    // If not found by messageId, try to find by recipient email + most recent sent email
    if (!sentEmail && data.to) {
      const recipientEmail = Array.isArray(data.to) ? data.to[0] : data.to;
      console.log(`[webhook] Message ID ${emailId} not found in DB, looking up by recipient email: ${recipientEmail}`);
      
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
      console.warn(`[webhook] Could not find sent email for message ${emailId} or recipient ${data.to}`);
      return res.status(404).json({ error: "Message not found" });
    }

    // Map Resend event types to our event types
    const eventTypeMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "sent", // Map delivered to sent as well
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
      // Fallback if type is missing but we have payload data
      eventType = "sent"; 
    }

    const timestamp = payload.created_at ? new Date(payload.created_at) : new Date();

    // Store the event in the database
    await db.insert(emailEventsTable).values({
      sentEmailId: sentEmail.id,
      messageId: emailId,
      eventType: eventType as any,
      timestamp,
      metadata: JSON.stringify(payload),
    });

    console.log(
      `[webhook] Stored ${eventType} event for message ${emailId}`
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("[webhook] Error processing Resend webhook:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
