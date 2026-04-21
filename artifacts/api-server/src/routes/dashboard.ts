import { Router, type IRouter } from "express";
import { db, campaignsTable, recipientsTable, sentEmailsTable, followUpStepsTable, emailEventsTable } from "@workspace/db";
import { eq, count, and, sql, gte } from "drizzle-orm";

const router: IRouter = Router();

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

  res.json({
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
    .limit(20);

  // Get email open and click events
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
  const sentEmailMap = new Map(sentEmails.map(se => [se.id, se]));

  for (const se of sentEmails) {
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
  for (const event of emailEvents) {
    const sentEmail = sentEmailMap.get(event.sentEmailId);
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

  activity.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  res.json(activity.slice(0, 30));
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
    
    res.json({ 
      success: true, 
      message: "Dashboard completely reset. All stats will count from now." 
    });
  } catch (error) {
    console.error("[admin] Error resetting stats:", error);
    res.status(500).json({ error: "Failed to reset stats" });
  }
});

export default router;
