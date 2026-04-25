import { Router, type IRouter } from "express";
import { db, campaignsTable, recipientsTable, sentEmailsTable, followUpStepsTable, emailEventsTable } from "../../../../lib/db/src/index";
import { eq, count, and, sql, gte, isNotNull, inArray, desc } from "drizzle-orm";
import { getResendCredentials } from "../lib/sendEmail";
import { Resend } from "resend";

const router: IRouter = Router();

router.get("/dashboard/debug-creds", async (req, res) => {
  const credentials = await getResendCredentials();
  res.json({
    hasResendApiKey: !!process.env.RESEND_API_KEY,
    hasReplitHostname: !!process.env.REPLIT_CONNECTORS_HOSTNAME,
    hasCredentials: !!credentials,
    envKeys: Object.keys(process.env).filter(k => k.includes("RESEND") || k.includes("REPLIT"))
  });
});

router.post("/dashboard/sync-analytics", async (req, res) => {
  try {
    const credentials = await getResendCredentials();
    if (!credentials) {
      return res.status(400).json({ error: "Resend not connected. Please connect Resend first." });
    }
    
    const resend = new Resend(credentials.apiKey);
    console.log(`[sync] Starting analytics sync with Resend...`);

    // Clean up malformed events (empty types)
    await db.delete(emailEventsTable).where(sql`${emailEventsTable.eventType} = ''`);
    
    // Find recent sent emails with message IDs - increased to 500
    const recentSentEmails = await db
      .select()
      .from(sentEmailsTable)
      .where(isNotNull(sentEmailsTable.messageId))
      .orderBy(sql`${sentEmailsTable.sentAt} DESC`)
      .limit(500);
      
    let newEventsCount = 0;
    
    // Iterate and sync status
    for (let i = 0; i < recentSentEmails.length; i++) {
      const email = recentSentEmails[i];
      try {
        // Add a small delay every 10 requests to respect Resend rate limits (10 req/s)
        if (i > 0 && i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`[sync] (${i + 1}/${recentSentEmails.length}) Checking status for message: ${email.messageId}`);
        const response = await resend.emails.get(email.messageId!);
        const data = response.data;

        if (data) {
          console.log(`[sync] Resend data for ${email.messageId}: last_event=${data.last_event}`);
          
          // Resend event mapping
          const eventTypeMap: Record<string, string> = {
            "delivered": "sent",
            "sent": "sent",
            "opened": "opened",
            "clicked": "clicked",
            "bounced": "bounced",
            "complaint": "complained",
          };
          
          const type = data.last_event ? (eventTypeMap[data.last_event] || data.last_event) : null;
          
          if (type) {
            // Logic to ensure we catch both if it's clicked
            const typesToSync = [type];
            if (type === 'clicked') {
              typesToSync.push('opened'); // Click implies open
            }

            for (const t of typesToSync) {
              if (t === 'opened' || t === 'clicked' || t === 'bounced') {
                const existing = await db
                  .select()
                  .from(emailEventsTable)
                  .where(and(
                    eq(emailEventsTable.sentEmailId, email.id),
                    eq(emailEventsTable.eventType, t as any)
                  ));
                  
                if (existing.length === 0) {
                  await db.insert(emailEventsTable).values({
                    sentEmailId: email.id,
                    messageId: email.messageId!,
                    eventType: t as any,
                    timestamp: new Date(data.created_at || Date.now()),
                    metadata: JSON.stringify({ ...data, sync: true, inferred: t !== type })
                  });
                  newEventsCount++;
                  console.log(`[sync] >> Succesfully synced ${t} event for ${email.messageId}`);
                }
              }
            }
          }
        }
      } catch (err) {
        // Skip individual errors (e.g. invalid ID or rate limit)
        console.warn(`[sync] Skip ${email.messageId}:`, err instanceof Error ? err.message : err);
      }
    }
    
    console.log(`[sync] Completed. Checked ${recentSentEmails.length} emails. Found ${newEventsCount} missing events.`);
    return res.json({ 
      success: true, 
      updatedCount: newEventsCount,
      checkedCount: recentSentEmails.length,
      credsFound: !!credentials
    });
  } catch (error) {
    console.error("[sync] Global error:", error);
    return res.status(500).json({ error: "Failed to sync analytics" });
  }
});

router.get("/dashboard/stats", async (req, res) => {
  const { days = 30 } = req.query;
  const daysBack = parseInt(days as string) || 30;
  
  const filterDate = new Date();
  filterDate.setDate(filterDate.getDate() - daysBack);
  filterDate.setHours(0, 0, 0, 0);

  const [totalCampaigns] = await db.select({ total: count() }).from(campaignsTable);
  const [activeCampaigns] = await db
    .select({ total: count() })
    .from(campaignsTable)
    .where(eq(campaignsTable.status, "active"));
  const [totalRecipients] = await db.select({ total: count() }).from(recipientsTable);
  const [totalReplied] = await db
    .select({ total: count() })
    .from(recipientsTable)
    .where(and(
      eq(recipientsTable.replied, true),
      sql`${recipientsTable.initialSentAt} IS NOT NULL`
    ));

  const [contactsEmailed] = await db
    .select({ total: count() })
    .from(recipientsTable)
    .where(sql`${recipientsTable.initialSentAt} IS NOT NULL`);

  const totalEmailed = Number(contactsEmailed?.total ?? 0);
  const totalRep = Number(totalReplied?.total ?? 0);

  // Email engagement stats
  const [emailsOpened] = await db
    .select({ total: count() })
    .from(emailEventsTable)
    .where(and(
      sql`${emailEventsTable.eventType} = 'opened'`,
      gte(emailEventsTable.timestamp, filterDate)
    ));

  const [emailsClicked] = await db
    .select({ total: count() })
    .from(emailEventsTable)
    .where(and(
      sql`${emailEventsTable.eventType} = 'clicked'`,
      gte(emailEventsTable.timestamp, filterDate)
    ));

  const [emailsSent] = await db
    .select({ total: count() })
    .from(sentEmailsTable)
    .where(and(
      eq(sentEmailsTable.status, "sent"),
      gte(sentEmailsTable.sentAt, filterDate)
    ));

  const totalSent = Number(emailsSent?.total ?? 0);
  const totalOpened = Number(emailsOpened?.total ?? 0);
  const totalClicked = Number(emailsClicked?.total ?? 0);

  const pendingFollowUpsResult = await db
    .select({ count: count() })
    .from(followUpStepsTable)
    .innerJoin(campaignsTable, eq(followUpStepsTable.campaignId, campaignsTable.id))
    .innerJoin(recipientsTable, and(
      eq(recipientsTable.campaignId, campaignsTable.id),
      eq(recipientsTable.replied, false),
      sql`${recipientsTable.initialSentAt} IS NOT NULL`
    ))
    .where(
      sql`NOT EXISTS (
        SELECT 1 FROM sent_emails se
        WHERE se.recipient_id = ${recipientsTable.id}
        AND se.follow_up_step_id = ${followUpStepsTable.id}
        AND se.status = 'sent'
      )`
    );

  const [pendingFollowUps] = pendingFollowUpsResult;

  return res.json({
    totalCampaigns: Number(totalCampaigns?.total ?? 0),
    activeCampaigns: Number(activeCampaigns?.total ?? 0),
    totalRecipients: totalEmailed,
    totalReplied: totalRep,
    replyRate: totalRep > 0 && totalEmailed > 0 ? Math.round((totalRep / totalEmailed) * 100) : 0,
    pendingFollowUps: Number(pendingFollowUps?.count ?? 0),
    emailsSent: totalSent,
    emailsOpened: totalOpened,
    emailsClicked: totalClicked,
    openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
    clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
  });
});

router.get("/dashboard/recent-activity", async (_req, res) => {
  // 1. Get recent email events (opens, clicks)
  const emailEvents = await db
    .select({
      id: emailEventsTable.id,
      sentEmailId: emailEventsTable.sentEmailId,
      eventType: emailEventsTable.eventType,
      timestamp: emailEventsTable.timestamp,
    })
    .from(emailEventsTable)
    .where(sql`${emailEventsTable.eventType} IN ('opened', 'clicked')`)
    .orderBy(sql`${emailEventsTable.timestamp} DESC`)
    .limit(50);

  // 2. Get recent sent emails
  const sentEmails = await db
    .select({
      id: sentEmailsTable.id,
      subject: sentEmailsTable.subject,
      sentAt: sentEmailsTable.sentAt,
      stepNumber: sentEmailsTable.stepNumber,
      email: recipientsTable.email,
      name: recipientsTable.name,
      campaignName: campaignsTable.name,
      replied: recipientsTable.replied,
      repliedAt: recipientsTable.repliedAt,
    })
    .from(sentEmailsTable)
    .innerJoin(recipientsTable, eq(sentEmailsTable.recipientId, recipientsTable.id))
    .innerJoin(campaignsTable, eq(recipientsTable.campaignId, campaignsTable.id))
    .where(eq(sentEmailsTable.status, "sent"))
    .orderBy(sql`${sentEmailsTable.sentAt} DESC`)
    .limit(50);

  // 3. For any email events associated with emails not currently in the recent sent list,
  // we should ideally fetch those too, but for simplicity and performance in a dashboard
  // we'll pool all potentially relevant sent email IDs first.
  const allNeededEmailIds = Array.from(new Set([
    ...sentEmails.map((se: any) => se.id),
    ...emailEvents.map((e: any) => e.sentEmailId)
  ]));

  // Re-fetch all needed sent email details in one go to ensure consistency
  const enrichedSentEmails = allNeededEmailIds.length > 0 ? await db
    .select({
      id: sentEmailsTable.id,
      subject: sentEmailsTable.subject,
      sentAt: sentEmailsTable.sentAt,
      stepNumber: sentEmailsTable.stepNumber,
      email: recipientsTable.email,
      name: recipientsTable.name,
      campaignName: campaignsTable.name,
      replied: recipientsTable.replied,
      repliedAt: recipientsTable.repliedAt,
    })
    .from(sentEmailsTable)
    .innerJoin(recipientsTable, eq(sentEmailsTable.recipientId, recipientsTable.id))
    .innerJoin(campaignsTable, eq(recipientsTable.campaignId, campaignsTable.id))
    .where(inArray(sentEmailsTable.id, allNeededEmailIds)) : [];

  const sentEmailMap = new Map(enrichedSentEmails.map((se: any) => [se.id, se]));

  const activity: Array<{
    id: number;
    type: "sent" | "replied" | "followup_sent" | "opened" | "clicked";
    campaignName: string;
    recipientEmail: string;
    recipientName: string;
    subject: string;
    occurredAt: string;
  }> = [];

  const repliedEmails = new Set<string>();

  // Use the top 30 most recent sent emails for the 'sent' activities
  for (const se of (sentEmails as any[]).slice(0, 30)) {
    activity.push({
      id: se.id,
      type: se.stepNumber === 0 ? "sent" : "followup_sent",
      campaignName: se.campaignName,
      recipientEmail: se.email,
      recipientName: se.name,
      subject: se.subject,
      occurredAt: se.sentAt.toISOString(),
    });

    if (se.replied && se.repliedAt && !repliedEmails.has(se.email)) {
      repliedEmails.add(se.email);
      activity.push({
        id: se.id + 100000,
        type: "replied",
        campaignName: se.campaignName,
        recipientEmail: se.email,
        recipientName: se.name,
        subject: `Re: ${se.subject}`,
        occurredAt: se.repliedAt.toISOString(),
      });
    }
  }

  // Add email open and click events
  for (const event of (emailEvents as any[])) {
    const sentEmail = sentEmailMap.get(event.sentEmailId) as any;
    if (sentEmail) {
      activity.push({
        id: event.id + 200000,
        type: event.eventType as "opened" | "clicked",
        campaignName: sentEmail.campaignName,
        recipientEmail: sentEmail.email,
        recipientName: sentEmail.name,
        subject: sentEmail.subject,
        occurredAt: event.timestamp.toISOString(),
      });
    }
  }

  activity.sort((a: any, b: any) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return res.json(activity.slice(0, 30));
});

router.get("/dashboard/activity-detail", async (req, res) => {
  const { type } = req.query;
  const activityType = type as string;
  
  if (!activityType || !['opened', 'clicked', 'replied'].includes(activityType)) {
    return res.status(400).json({ error: "Invalid type" });
  }

  try {
    if (activityType === 'replied') {
      const results = await db
        .select({
          recipientName: recipientsTable.name,
          recipientEmail: recipientsTable.email,
          campaignName: campaignsTable.name,
          occurredAt: recipientsTable.repliedAt,
        })
        .from(recipientsTable)
        .innerJoin(campaignsTable, eq(recipientsTable.campaignId, campaignsTable.id))
        .where(eq(recipientsTable.replied, true))
        .orderBy(desc(recipientsTable.repliedAt))
        .limit(100);
      
      // Filter out null occurredAt before mapping
      return res.json(results
        .filter((r: any) => r.occurredAt !== null)
        .map((r: any) => ({ 
          ...r, 
          id: Math.random(), 
          type: 'replied',
          occurredAt: r.occurredAt!.toISOString() 
        }))
      );
    } else {
      const results = await db
        .select({
          id: emailEventsTable.id,
          eventType: emailEventsTable.eventType,
          occurredAt: emailEventsTable.timestamp,
          recipientName: recipientsTable.name,
          recipientEmail: recipientsTable.email,
          campaignName: campaignsTable.name,
          subject: sentEmailsTable.subject,
        })
        .from(emailEventsTable)
        .innerJoin(sentEmailsTable, eq(emailEventsTable.sentEmailId, sentEmailsTable.id))
        .innerJoin(recipientsTable, eq(sentEmailsTable.recipientId, recipientsTable.id))
        .innerJoin(campaignsTable, eq(recipientsTable.campaignId, campaignsTable.id))
        .where(eq(emailEventsTable.eventType, activityType as any))
        .orderBy(desc(emailEventsTable.timestamp))
        .limit(100);
      
      return res.json(results.map((r: any) => ({ 
        ...r, 
        type: activityType,
        occurredAt: r.occurredAt.toISOString()
      })));
    }
  } catch (error) {
    console.error(`[activity-detail] Error:`, error);
    return res.status(500).json({ error: "Failed to fetch activity detail" });
  }
});

router.post("/dashboard/reset-stats", async (req, res) => {
  try {
    // Clear all email events
    await db.delete(emailEventsTable);
    console.log(`[admin] Cleared all email events`);
    
    // Clear all sent emails
    await db.delete(sentEmailsTable);
    console.log(`[admin] Cleared all sent emails`);
    
    // Reset reply status but keep initialSentAt so calendar shows scheduled follow-ups
    await db.update(recipientsTable).set({
      replied: false,
    });
    console.log(`[admin] Reset all recipients' reply status`);
    
    return res.json({ 
      success: true, 
      message: "Dashboard completely reset. All stats will count from now." 
    });
  } catch (error) {
    console.error("[admin] Error resetting stats:", error);
    return res.status(500).json({ error: "Failed to reset stats" });
  }
});

export default router;
