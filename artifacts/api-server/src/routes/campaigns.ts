import { Router, type IRouter } from "express";
import { db, campaignsTable, recipientsTable, followUpStepsTable, sentEmailsTable, emailEventsTable, reasonsTable, reasonFollowUpTemplatesTable } from "@workspace/db";
import { eq, count, and, sql } from "drizzle-orm";
import {
  CreateCampaignBody,
  GetCampaignParams,
  UpdateCampaignParams,
  UpdateCampaignBody,
  DeleteCampaignParams,
  SendCampaignParams,
  SendTestEmailParams,
  SendTestEmailBody,
  ListRecipientsParams,
  AddRecipientParams,
  AddRecipientBody,
  RemoveRecipientParams,
  MarkRepliedParams,
  MarkRepliedBody,
  ListFollowUpStepsParams,
  CreateFollowUpStepParams,
  CreateFollowUpStepBody,
  UpdateFollowUpStepParams,
  UpdateFollowUpStepBody,
  DeleteFollowUpStepParams,
} from "@workspace/api-zod";
import { sendEmail, getResendCredentials } from "../lib/sendEmail";
import { substituteVariables } from "../lib/variableSubstitution";

const router: IRouter = Router();

async function getCampaignCounts(campaignId: number) {
  const [recipients] = await db
    .select({ total: count() })
    .from(recipientsTable)
    .where(eq(recipientsTable.campaignId, campaignId));
  const [replied] = await db
    .select({ total: count() })
    .from(recipientsTable)
    .where(and(eq(recipientsTable.campaignId, campaignId), eq(recipientsTable.replied, true)));
  const [sent] = await db
    .select({ total: count() })
    .from(sentEmailsTable)
    .innerJoin(recipientsTable, eq(sentEmailsTable.recipientId, recipientsTable.id))
    .where(and(eq(recipientsTable.campaignId, campaignId), eq(sentEmailsTable.status, "sent")));

  // Count distinct recipients who opened at least one email in this campaign
  const [opened] = await db
    .select({ total: count() })
    .from(emailEventsTable)
    .innerJoin(sentEmailsTable, eq(emailEventsTable.sentEmailId, sentEmailsTable.id))
    .innerJoin(recipientsTable, eq(sentEmailsTable.recipientId, recipientsTable.id))
    .where(and(
      eq(recipientsTable.campaignId, campaignId),
      eq(emailEventsTable.eventType, "opened")
    ));

  // Count distinct recipients who clicked at least one email in this campaign
  const [clicked] = await db
    .select({ total: count() })
    .from(emailEventsTable)
    .innerJoin(sentEmailsTable, eq(emailEventsTable.sentEmailId, sentEmailsTable.id))
    .innerJoin(recipientsTable, eq(sentEmailsTable.recipientId, recipientsTable.id))
    .where(and(
      eq(recipientsTable.campaignId, campaignId),
      eq(emailEventsTable.eventType, "clicked")
    ));

  return {
    recipientCount: recipients?.total ?? 0,
    repliedCount: replied?.total ?? 0,
    sentCount: sent?.total ?? 0,
    openedCount: opened?.total ?? 0,
    clickedCount: clicked?.total ?? 0,
  };
}

async function shouldCampaignBeCompleted(campaignId: number): Promise<boolean> {
  // Get the number of follow-up steps
  const [followUpCount] = await db
    .select({ count: count() })
    .from(followUpStepsTable)
    .where(eq(followUpStepsTable.campaignId, campaignId));
  
  const totalStepsPerRecipient = (followUpCount?.count ?? 0) + 1; // +1 for initial email
  
  // Get total recipients count
  const [recipientsResult] = await db
    .select({ count: count() })
    .from(recipientsTable)
    .where(eq(recipientsTable.campaignId, campaignId));
  
  const recipientCount = recipientsResult?.count ?? 0;
  if (recipientCount === 0) return false;
  
  // Get total sent emails count
  const [sentResult] = await db
    .select({ count: count() })
    .from(sentEmailsTable)
    .innerJoin(recipientsTable, eq(sentEmailsTable.recipientId, recipientsTable.id))
    .where(
      and(
        eq(recipientsTable.campaignId, campaignId),
        eq(sentEmailsTable.status, "sent")
      )
    );
  
  const totalSentEmails = sentResult?.count ?? 0;
  const expectedTotalEmails = recipientCount * totalStepsPerRecipient;
  
  // Campaign is complete if all expected emails have been sent
  return totalSentEmails >= expectedTotalEmails;
}

router.get("/campaigns", async (req, res) => {
  const includeDetails = req.query.include_details === "true";
  
  // Use optimized query to get campaigns ordered by creation date
  const campaigns = await db.select().from(campaignsTable).orderBy(sql`${campaignsTable.createdAt} DESC`);
  
  // Process campaigns in parallel with efficient, targeted queries
  const result = await Promise.all(
    campaigns.map(async (c: any) => {
      // 1. Get counts (recipient, replied, sent) - optimized helper
      const counts = await getCampaignCounts(c.id);
      
      // 2. Get the reason summary (name/color) only
      let reason = null;
      if (c.reasonId) {
        const [reasonData] = await db.select().from(reasonsTable).where(eq(reasonsTable.id, c.reasonId));
        reason = reasonData || null;
      }
      
      // 3. Get follow-up steps (either count or full list)
      let followUpSteps: any[] = [];
      let followUpCount = 0;
      
      if (includeDetails) {
        followUpSteps = await db
          .select()
          .from(followUpStepsTable)
          .where(eq(followUpStepsTable.campaignId, c.id))
          .orderBy(followUpStepsTable.stepNumber);
        followUpCount = followUpSteps.length;
      } else {
        const [{ count: fCount }] = await db
          .select({ count: count() })
          .from(followUpStepsTable)
          .where(eq(followUpStepsTable.campaignId, c.id));
        followUpCount = Number(fCount ?? 0);
      }
      
      // 4. Get recipients (either first one for display or full list for calendar)
      let recipients: any[] = [];
      let firstRecipientData = null;
      
      if (includeDetails) {
        recipients = await db
          .select()
          .from(recipientsTable)
          .where(eq(recipientsTable.campaignId, c.id));
        firstRecipientData = recipients[0];
      } else {
        const [first] = await db
          .select({ name: recipientsTable.name, email: recipientsTable.email })
          .from(recipientsTable)
          .where(eq(recipientsTable.campaignId, c.id))
          .limit(1);
        firstRecipientData = first;
      }
      
      // 5. Light-weight status check (only if necessary)
      let status = c.status;
      if (status === "active" || status === "paused") {
        const isCompleted = await shouldCampaignBeCompleted(c.id);
        if (isCompleted) {
          status = "completed";
          await db
            .update(campaignsTable)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(campaignsTable.id, c.id));
        }
      }
      
      return { 
        ...c,
        reason,
        status,
        ...counts,
        followUpCount,
        followUpSteps,
        recipients,
        recipientName: firstRecipientData?.name || null,
        recipientEmail: firstRecipientData?.email || null
      };
    })
  );
  res.json(result);
  return;
});

router.post("/campaigns", async (req, res) => {
  let data = CreateCampaignBody.parse(req.body);
  
  // If no footer data is provided, automatically populate from campaign 11 (Alessandro's default footer)
  if (!data.footerName) {
    const [fallbackCampaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, 11));
    
    if (fallbackCampaign && fallbackCampaign.footerName) {
      console.log("[create-campaign] No footer provided, using fallback from campaign 11");
      data = {
        ...data,
        footerName: fallbackCampaign.footerName,
        footerTitle: fallbackCampaign.footerTitle,
        footerImageUrl: fallbackCampaign.footerImageUrl,
        footerWebsite: fallbackCampaign.footerWebsite,
        footerWebsiteUrl: fallbackCampaign.footerWebsiteUrl,
        footerFacebook: fallbackCampaign.footerFacebook,
        footerInstagram: fallbackCampaign.footerInstagram,
        footerYoutube: fallbackCampaign.footerYoutube,
      };
    }
  }
  
  const result = await db.insert(campaignsTable).values(data);
  const insertId = (result as any)[0]?.insertId || result.lastID;
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, insertId));
  
  res.status(201).json({ ...campaign, recipientCount: 0, repliedCount: 0, sentCount: 0 });
  return;
});

router.get("/campaigns/:id", async (req, res) => {
  const { id } = GetCampaignParams.parse(req.params);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  // Get the reason if reasonId is set
  let reason = null;
  if (campaign.reasonId) {
    const [reasonData] = await db.select().from(reasonsTable).where(eq(reasonsTable.id, campaign.reasonId));
    reason = reasonData || null;
  }

  const recipients = await db
    .select()
    .from(recipientsTable)
    .where(eq(recipientsTable.campaignId, id))
    .orderBy(recipientsTable.createdAt);

  const followUpSteps = await db
    .select()
    .from(followUpStepsTable)
    .where(eq(followUpStepsTable.campaignId, id))
    .orderBy(followUpStepsTable.stepNumber);

  const recipientsWithActivity = await Promise.all(
    recipients.map(async (r: any) => {
      const sentEmails = await db
        .select()
        .from(sentEmailsTable)
        .where(eq(sentEmailsTable.recipientId, r.id))
        .orderBy(sentEmailsTable.sentAt);
      return { ...r, sentEmails };
    })
  );

  // Check if campaign should be marked as completed
  let status = campaign.status;
  if (status === "active" || status === "paused") {
    const isCompleted = await shouldCampaignBeCompleted(id);
    if (isCompleted) {
      status = "completed";
      // Update the database to reflect the completed status
      await db
        .update(campaignsTable)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(campaignsTable.id, id));
    }
  }

  res.json({ ...campaign, status, reason, recipients: recipientsWithActivity, followUpSteps });
  return;
});

router.put("/campaigns/:id", async (req, res) => {
  const { id } = UpdateCampaignParams.parse(req.params);
  const data = UpdateCampaignBody.parse(req.body);
  await db
    .update(campaignsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(campaignsTable.id, id));
  const [updated] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!updated) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  const counts = await getCampaignCounts(id);
  res.json({ ...updated, ...counts });
  return;
});

router.delete("/campaigns/:id", async (req, res) => {
  const { id } = DeleteCampaignParams.parse(req.params);
  await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
  res.status(204).end();
  return;
});

router.post("/campaigns/:id/send", async (req, res) => {
  const { id } = SendCampaignParams.parse(req.params);
  let [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  // If campaign has no footer data, try to use footer from campaign 11 (in case it's a duplicate)
  if (!campaign.footerName) {
    const [fallbackCampaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, 11));
    if (fallbackCampaign && fallbackCampaign.footerName) {
      campaign = { ...campaign, 
        footerName: fallbackCampaign.footerName,
        footerTitle: fallbackCampaign.footerTitle,
        footerImageUrl: fallbackCampaign.footerImageUrl,
        footerWebsite: fallbackCampaign.footerWebsite,
        footerWebsiteUrl: fallbackCampaign.footerWebsiteUrl,
        footerFacebook: fallbackCampaign.footerFacebook,
        footerInstagram: fallbackCampaign.footerInstagram,
        footerYoutube: fallbackCampaign.footerYoutube,
      };
      console.log(`[send] Campaign ${id} had no footer, using campaign 11 footer`);
    }
  }

  const recipients = await db
    .select()
    .from(recipientsTable)
    .where(and(
      eq(recipientsTable.campaignId, id),
      eq(recipientsTable.replied, false),
      sql`${recipientsTable.initialSentAt} IS NULL`
    ));

  console.log(`[send] Found ${recipients.length} recipients for campaign ${id}`);

  if (recipients.length === 0) {
    console.log(`[send] No unsent recipients for campaign ${id}. Campaign may have already been sent.`);
    res.json({ sent: 0, failed: 0, message: "No recipients found that haven't already received this campaign." });
    return;
  }

  const credentials = await getResendCredentials();
  if (!credentials) {
    console.error(`[send] Failed to start campaign ${id}: Resend credentials not found.`);
    res.status(400).json({ 
      error: "Resend not configured", 
      message: "Please configure your RESEND_API_KEY and RESEND_FROM_EMAIL in the Secrets panel before starting a campaign." 
    });
    return;
  }

  let sent = 0;
  let failed = 0;
  let lastError = "";

  // Build footer if any footer fields are present
  let emailBody = campaign.body;
  let htmlBody = campaign.body.replace(/\n/g, "<br/>");
  
  if (campaign.footerName) {
    // Plain text footer
    const footerLines: string[] = [];
    footerLines.push(""); // blank line before footer
    footerLines.push("---");
    footerLines.push(campaign.footerName);
    if (campaign.footerTitle) footerLines.push(campaign.footerTitle);
    if (campaign.footerWebsite) footerLines.push(campaign.footerWebsite);
    if (campaign.footerWebsiteUrl) footerLines.push(`Visit: ${campaign.footerWebsiteUrl}`);
    
    const socialLinks: string[] = [];
    if (campaign.footerFacebook) socialLinks.push(`Facebook: https://facebook.com/${campaign.footerFacebook}`);
    if (campaign.footerInstagram) socialLinks.push(`Instagram: https://instagram.com/${campaign.footerInstagram}`);
    if (campaign.footerYoutube) socialLinks.push(`YouTube: https://youtube.com/${campaign.footerYoutube}`);
    if (socialLinks.length > 0) {
      footerLines.push(...socialLinks);
    }
    
    emailBody = campaign.body + "\n\n" + footerLines.join("\n");
    
    // HTML footer with image on left, text on right
    let htmlFooter = '<div style="border-top: 1px solid #ccc; margin-top: 24px; padding-top: 24px; max-width: 100%; overflow: hidden;">';
    htmlFooter += '<table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">';
    htmlFooter += '<tr>';
    
    // Left column: image
    if (campaign.footerImageUrl) {
      htmlFooter += '<td style="padding-right: 16px; vertical-align: top; width: 80px; flex-shrink: 0;">';
      htmlFooter += `<img src="${campaign.footerImageUrl}" alt="${campaign.footerName}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; display: block;" />`;
      htmlFooter += '</td>';
    }
    
    // Right column: text and social icons
    htmlFooter += '<td style="padding: 0; vertical-align: top;">';
    htmlFooter += `<p style="margin: 0; font-weight: bold; font-size: 16px; color: #000;">${campaign.footerName}</p>`;
    if (campaign.footerTitle) {
      htmlFooter += `<p style="margin: 4px 0 8px 0; font-weight: 600; font-size: 14px; color: #333;">${campaign.footerTitle}</p>`;
    }
    if (campaign.footerWebsite) {
      htmlFooter += `<p style="margin: 4px 0; font-size: 14px; color: #666;"><a href="${campaign.footerWebsiteUrl}" style="color: #6366F1; text-decoration: none;">${campaign.footerWebsite}</a></p>`;
    }
    
    if (campaign.footerFacebook || campaign.footerInstagram || campaign.footerYoutube) {
      htmlFooter += '<div style="margin-top: 12px;">';
      if (campaign.footerFacebook) {
        htmlFooter += `<a href="https://facebook.com/${campaign.footerFacebook}" style="display: inline-block; text-decoration: none; margin-right: 8px;"><img src="https://cdn-icons-png.flaticon.com/32/733/733547.png" width="32" height="32" style="display: block; border: 0;" /></a>`;
      }
      if (campaign.footerInstagram) {
        htmlFooter += `<a href="https://instagram.com/${campaign.footerInstagram}" style="display: inline-block; text-decoration: none; margin-right: 8px;"><img src="https://cdn-icons-png.flaticon.com/32/174/174855.png" width="32" height="32" style="display: block; border: 0;" /></a>`;
      }
      if (campaign.footerYoutube) {
        htmlFooter += `<a href="https://youtube.com/${campaign.footerYoutube}" style="display: inline-block; text-decoration: none; margin-right: 8px;"><img src="https://cdn-icons-png.flaticon.com/32/1384/1384060.png" width="32" height="32" style="display: block; border: 0;" /></a>`;
      }
      htmlFooter += '</div>';
    }
    
    htmlFooter += '</td>';
    htmlFooter += '</tr>';
    htmlFooter += '</table>';
    htmlFooter += '</div>';
    htmlBody = htmlBody + htmlFooter;
  }

  for (const recipient of recipients) {
    // Substitute variables in subject and body
    const substitutedSubject = substituteVariables(campaign.subject, {
      name: recipient.name,
      email: recipient.email,
      company: recipient.company || "",
    });
    const substitutedBody = substituteVariables(emailBody, {
      name: recipient.name,
      email: recipient.email,
      company: recipient.company || "",
    });
    const substitutedHtmlBody = substituteVariables(htmlBody, {
      name: recipient.name,
      email: recipient.email,
      company: recipient.company || "",
    });

    const result = await sendEmail({
      to: recipient.email,
      toName: recipient.name,
      from: campaign.fromEmail,
      fromName: campaign.fromName,
      subject: substitutedSubject,
      body: substitutedBody,
      htmlBody: substitutedHtmlBody,
    });

    console.log(`[send] SendEmail result for ${recipient.email}:`, JSON.stringify({ success: result.success, messageId: result.messageId, error: result.error }));

    if (result.success) {
      await db
        .update(recipientsTable)
        .set({ initialSentAt: new Date() })
        .where(and(eq(recipientsTable.id, recipient.id), eq(recipientsTable.campaignId, id)));

      await db.insert(sentEmailsTable).values({
        recipientId: recipient.id,
        messageId: result.messageId,
        subject: substitutedSubject,
        body: substitutedBody,
        sentAt: new Date(),
        status: "sent",
        stepNumber: 0,
      });
      sent++;
    } else {
      lastError = result.error || "Unknown error";
      await db.insert(sentEmailsTable).values({
        recipientId: recipient.id,
        subject: campaign.subject,
        body: emailBody,
        sentAt: new Date(),
        status: "failed",
        stepNumber: 0,
      });
      failed++;
    }
  }

  if (sent > 0) {
    await db
      .update(campaignsTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(campaignsTable.id, id));
  }

  res.json({ 
    sent, 
    failed, 
    message: sent > 0 
      ? `Successfully sent ${sent} email(s)${failed > 0 ? `, but ${failed} failed` : ""}.` 
      : `Failed to send emails. ${failed > 0 ? `Errors: ${lastError}` : "No recipients were processed."}`
  });
  return;
});

// Pause a campaign
router.post("/campaigns/:id/pause", async (req, res) => {
  const { id } = SendCampaignParams.parse(req.params);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  if (campaign.status !== "active") {
    res.status(400).json({ error: "Campaign is not active" });
    return;
  }

  await db
    .update(campaignsTable)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(campaignsTable.id, id));

  res.json({ message: "Campaign paused successfully" });
  return;
});

// Resume a paused campaign
router.post("/campaigns/:id/resume", async (req, res) => {
  const { id } = SendCampaignParams.parse(req.params);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  if (campaign.status !== "paused") {
    res.status(400).json({ error: "Campaign is not paused" });
    return;
  }

  await db
    .update(campaignsTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(campaignsTable.id, id));

  res.json({ message: "Campaign resumed successfully" });
  return;
});

// Send test email for a campaign
router.post("/campaigns/:id/test-email", async (req, res) => {
  const { id } = SendTestEmailParams.parse(req.params);
  const { testEmail, stepNumber } = SendTestEmailBody.parse(req.body);
  
  let [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  // If campaign has no footer data, try to use footer from campaign 11 (in case it's a duplicate)
  if (!campaign.footerName) {
    const [fallbackCampaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, 11));
    if (fallbackCampaign && fallbackCampaign.footerName) {
      campaign = { ...campaign, 
        footerName: fallbackCampaign.footerName,
        footerTitle: fallbackCampaign.footerTitle,
        footerImageUrl: fallbackCampaign.footerImageUrl,
        footerWebsite: fallbackCampaign.footerWebsite,
        footerWebsiteUrl: fallbackCampaign.footerWebsiteUrl,
        footerFacebook: fallbackCampaign.footerFacebook,
        footerInstagram: fallbackCampaign.footerInstagram,
        footerYoutube: fallbackCampaign.footerYoutube,
      };
      console.log(`[test-email] Campaign ${id} had no footer, using campaign 11 footer`);
    }
  }

  // Determine if we're testing a follow-up step or the initial email
  let emailSubject = campaign.subject;
  let emailBody = campaign.body;
  let includeFooter = true; // Default to true for initial email (campaigns don't have includeFooter column)
  let originalSubject = campaign.subject;
  let originalBody = campaign.body;

  if (stepNumber !== undefined && stepNumber > 0) {
    // Fetch the follow-up step
    const [step] = await db
      .select()
      .from(followUpStepsTable)
      .where(and(eq(followUpStepsTable.campaignId, id), eq(followUpStepsTable.stepNumber, stepNumber)));
    
    if (!step) {
      res.status(404).json({ error: `Follow-up step ${stepNumber} not found` });
      return;
    }
    
    emailSubject = step.subject;
    emailBody = step.body;
    includeFooter = step.includeFooter ?? true; // Follow-up steps default to true if not specified
  }

  let htmlBody = emailBody;
  
  console.log(`[test-email] Campaign ${id} - footerName: "${campaign.footerName}", includeFooter: ${includeFooter}, stepNumber: ${stepNumber}`);
  
  // Add footer only if campaign has footer data AND the step allows it (for follow-ups, respect the includeFooter flag)
  if (campaign.footerName && includeFooter) {
    console.log(`[test-email] Adding footer for campaign ${id}`);
    // Plain text footer
    const footerLines: string[] = [];
    footerLines.push("");
    footerLines.push("---");
    footerLines.push(campaign.footerName);
    if (campaign.footerTitle) footerLines.push(campaign.footerTitle);
    if (campaign.footerWebsite) footerLines.push(campaign.footerWebsite);
    if (campaign.footerWebsiteUrl) footerLines.push(`Visit: ${campaign.footerWebsiteUrl}`);
    
    const socialLinks: string[] = [];
    if (campaign.footerFacebook) socialLinks.push(`Facebook: https://facebook.com/${campaign.footerFacebook}`);
    if (campaign.footerInstagram) socialLinks.push(`Instagram: https://instagram.com/${campaign.footerInstagram}`);
    if (campaign.footerYoutube) socialLinks.push(`YouTube: https://youtube.com/${campaign.footerYoutube}`);
    if (socialLinks.length > 0) footerLines.push(...socialLinks);
    
    emailBody = emailBody + "\n\n" + footerLines.join("\n");
    
    // HTML footer
    let htmlFooter = '<div style="border-top: 1px solid #ccc; margin-top: 24px; padding-top: 24px; max-width: 100%; overflow: hidden;">';
    htmlFooter += '<table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">';
    htmlFooter += '<tr>';
    
    if (campaign.footerImageUrl) {
      htmlFooter += '<td style="padding-right: 16px; vertical-align: top; width: 80px; flex-shrink: 0;">';
      htmlFooter += `<img src="${campaign.footerImageUrl}" alt="${campaign.footerName}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; display: block;" />`;
      htmlFooter += '</td>';
    }
    
    htmlFooter += '<td style="padding: 0; vertical-align: top;">';
    htmlFooter += `<p style="margin: 0; font-weight: bold; font-size: 16px; color: #000;">${campaign.footerName}</p>`;
    if (campaign.footerTitle) {
      htmlFooter += `<p style="margin: 4px 0 8px 0; font-weight: 600; font-size: 14px; color: #333;">${campaign.footerTitle}</p>`;
    }
    if (campaign.footerWebsite) {
      htmlFooter += `<p style="margin: 4px 0; font-size: 14px; color: #666;"><a href="${campaign.footerWebsiteUrl}" style="color: #6366F1; text-decoration: none;">${campaign.footerWebsite}</a></p>`;
    }
    
    if (campaign.footerFacebook || campaign.footerInstagram || campaign.footerYoutube) {
      htmlFooter += '<div style="margin-top: 12px;">';
      if (campaign.footerFacebook) {
        htmlFooter += `<a href="https://facebook.com/${campaign.footerFacebook}" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background-color: #6366F1; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 16px; color: white; margin-right: 4px;">f</a>`;
      }
      if (campaign.footerInstagram) {
        htmlFooter += `<a href="https://instagram.com/${campaign.footerInstagram}" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background-color: #6366F1; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 16px; color: white; margin-right: 4px;">@</a>`;
      }
      if (campaign.footerYoutube) {
        htmlFooter += `<a href="https://youtube.com/${campaign.footerYoutube}" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background-color: #6366F1; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 16px; color: white; margin-right: 4px;">▶</a>`;
      }
      htmlFooter += '</div>';
    }
    
    htmlFooter += '</td></tr></table></div>';
    htmlBody = htmlBody + htmlFooter;
  }

  // Fetch the first recipient to get their company data for variable substitution
  const [firstRecipient] = await db
    .select()
    .from(recipientsTable)
    .where(eq(recipientsTable.campaignId, id))
    .limit(1);

  // Substitute variables in subject and body for test email
  const substitutedSubject = substituteVariables(emailSubject, {
    original_subject: originalSubject,
    name: firstRecipient?.name || "Test Recipient",
    email: testEmail,
    company: firstRecipient?.company || "",
  });
  const substitutedBody = substituteVariables(emailBody, {
    original_subject: originalSubject,
    name: firstRecipient?.name || "Test Recipient",
    email: testEmail,
    company: firstRecipient?.company || "",
  });
  const substitutedHtmlBody = substituteVariables(htmlBody, {
    original_subject: originalSubject,
    name: firstRecipient?.name || "Test Recipient",
    email: testEmail,
    company: firstRecipient?.company || "",
  });

  const result = await sendEmail({
    to: testEmail,
    toName: "Test Recipient",
    from: campaign.fromEmail,
    fromName: campaign.fromName,
    subject: substitutedSubject,
    body: substitutedBody,
    htmlBody: substitutedHtmlBody,
  });

  console.log(`[send-test] SendEmail result for ${testEmail}:`, JSON.stringify({ success: result.success, messageId: result.messageId, error: result.error }));

  if (result.success) {
    res.json({ success: true, message: `Test email sent to ${testEmail}` });
  } else {
    res.status(400).json({ success: false, message: result.error || "Failed to send test email" });
  }
});

router.get("/campaigns/:id/recipients", async (req, res) => {
  const { id } = ListRecipientsParams.parse(req.params);
  const recipients = await db
    .select()
    .from(recipientsTable)
    .where(eq(recipientsTable.campaignId, id))
    .orderBy(recipientsTable.createdAt);
  res.json(recipients);
  return;
});

router.post("/campaigns/:id/recipients", async (req, res) => {
  const { id } = AddRecipientParams.parse(req.params);
  const data = AddRecipientBody.parse(req.body);
  const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  const result = await db.insert(recipientsTable).values({ campaignId: id, ...data });
  const insertId = (result as any)[0]?.insertId || result.lastID;
  const [recipient] = await db.select().from(recipientsTable).where(eq(recipientsTable.id, insertId));
  res.status(201).json(recipient);
  return;
});

router.delete("/campaigns/:id/recipients/:recipientId", async (req, res) => {
  const { id, recipientId } = RemoveRecipientParams.parse(req.params);
  const [recipient] = await db.select().from(recipientsTable).where(and(eq(recipientsTable.id, recipientId), eq(recipientsTable.campaignId, id)));
  if (!recipient) {
    res.status(404).json({ error: "Recipient not found in this campaign" });
    return;
  }
  await db.delete(recipientsTable).where(and(eq(recipientsTable.id, recipientId), eq(recipientsTable.campaignId, id)));
  res.status(204).end();
  return;
});

router.post("/campaigns/:id/recipients/:recipientId/reply", async (req, res) => {
  const { id, recipientId } = MarkRepliedParams.parse(req.params);
  const data = MarkRepliedBody.parse(req.body);
  await db
    .update(recipientsTable)
    .set({ replied: data.replied, repliedAt: data.replied ? new Date() : null })
    .where(and(eq(recipientsTable.id, recipientId), eq(recipientsTable.campaignId, id)));
  const [updated] = await db.select().from(recipientsTable).where(and(eq(recipientsTable.id, recipientId), eq(recipientsTable.campaignId, id)));
  if (!updated) {
    res.status(404).json({ error: "Recipient not found in this campaign" });
    return;
  }
  res.json(updated);
  return;
});

router.post("/campaigns/:id/recipients/:recipientId/mark-sent", async (req, res) => {
  const { id, recipientId } = MarkRepliedParams.parse(req.params);
  await db
    .update(recipientsTable)
    .set({ initialSentAt: new Date() })
    .where(and(eq(recipientsTable.id, recipientId), eq(recipientsTable.campaignId, id)));
  const [updated] = await db.select().from(recipientsTable).where(and(eq(recipientsTable.id, recipientId), eq(recipientsTable.campaignId, id)));
  if (!updated) {
    res.status(404).json({ error: "Recipient not found in this campaign" });
    return;
  }
  res.json(updated);
  return;
});

router.get("/campaigns/:id/followups", async (req, res) => {
  const { id } = ListFollowUpStepsParams.parse(req.params);
  const steps = await db
    .select()
    .from(followUpStepsTable)
    .where(eq(followUpStepsTable.campaignId, id))
    .orderBy(followUpStepsTable.stepNumber);
  res.json(steps);
  return;
});

router.post("/campaigns/:id/followups", async (req, res) => {
  const { id } = CreateFollowUpStepParams.parse(req.params);
  const data = CreateFollowUpStepBody.parse(req.body);

  const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  // Use provided stepNumber if given, otherwise auto-increment from highest existing
  let stepNumber = data.stepNumber;
  if (stepNumber === undefined) {
    const [lastStep] = await db
      .select()
      .from(followUpStepsTable)
      .where(eq(followUpStepsTable.campaignId, id))
      .orderBy(sql`${followUpStepsTable.stepNumber} DESC`)
      .limit(1);
    stepNumber = (lastStep?.stepNumber ?? 0) + 1;
  }

  const { stepNumber: _, ...insertData } = data; // Exclude stepNumber from data to avoid duplicate
  const result = await db.insert(followUpStepsTable).values({ campaignId: id, stepNumber, ...insertData });
  const insertId = (result as any)[0]?.insertId || result.lastID;
  const [step] = await db.select().from(followUpStepsTable).where(eq(followUpStepsTable.id, insertId));
  res.status(201).json(step);
  return;
});

router.put("/campaigns/:id/followups/:stepId", async (req, res) => {
  const { id, stepId } = UpdateFollowUpStepParams.parse(req.params);
  const data = UpdateFollowUpStepBody.parse(req.body);
  await db
    .update(followUpStepsTable)
    .set(data)
    .where(and(eq(followUpStepsTable.id, stepId), eq(followUpStepsTable.campaignId, id)));
  const [updated] = await db.select().from(followUpStepsTable).where(and(eq(followUpStepsTable.id, stepId), eq(followUpStepsTable.campaignId, id)));
  if (!updated) {
    res.status(404).json({ error: "Follow-up step not found in this campaign" });
    return;
  }
  res.json(updated);
  return;
});

router.delete("/campaigns/:id/followups/:stepId", async (req, res) => {
  const { id, stepId } = DeleteFollowUpStepParams.parse(req.params);
  const [step] = await db.select().from(followUpStepsTable).where(and(eq(followUpStepsTable.id, stepId), eq(followUpStepsTable.campaignId, id)));
  if (!step) {
    res.status(404).json({ error: "Follow-up step not found in this campaign" });
    return;
  }
  await db.delete(followUpStepsTable).where(and(eq(followUpStepsTable.id, stepId), eq(followUpStepsTable.campaignId, id)));
  res.status(204).end();
  return;
});

// Reasons endpoints
router.get("/reasons", async (_req, res) => {
  const reasons = await db.select().from(reasonsTable).orderBy(reasonsTable.name);
  const templates = await db.select().from(reasonFollowUpTemplatesTable).orderBy(reasonFollowUpTemplatesTable.stepNumber);
  const result = reasons.map((r: any) => ({
    ...r,
    followUpTemplates: templates.filter((t: any) => t.reasonId === r.id),
  }));
  res.json(result);
  return;
});

router.post("/reasons", async (req, res) => {
  const { name, color } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const result = await db.insert(reasonsTable).values({ name, color: color || "#6366F1" });
  const insertId = (result as any)[0]?.insertId || result.lastID;
  const [reason] = await db.select().from(reasonsTable).where(eq(reasonsTable.id, insertId));
  res.status(201).json({ ...reason, followUpTemplates: [] });
  return;
});

router.put("/reasons/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { templateSubject, templateBody, templateFromName, templateFromEmail, templateIncludeFooter } = req.body;
  await db
    .update(reasonsTable)
    .set({ templateSubject, templateBody, templateFromName, templateFromEmail, templateIncludeFooter })
    .where(eq(reasonsTable.id, id));
  const [reason] = await db.select().from(reasonsTable).where(eq(reasonsTable.id, id));
  if (!reason) {
    res.status(404).json({ error: "Reason not found" });
    return;
  }
  const templates = await db.select().from(reasonFollowUpTemplatesTable).where(eq(reasonFollowUpTemplatesTable.reasonId, id)).orderBy(reasonFollowUpTemplatesTable.stepNumber);
  res.json({ ...reason, followUpTemplates: templates });
  return;
});

router.delete("/reasons/:id", async (req, res) => {
  const { id } = req.params;
  const [reason] = await db.select().from(reasonsTable).where(eq(reasonsTable.id, parseInt(id, 10)));
  if (!reason) {
    res.status(404).json({ error: "Reason not found" });
    return;
  }
  await db.delete(reasonsTable).where(eq(reasonsTable.id, parseInt(id, 10)));
  res.status(204).end();
  return;
});

// Reason follow-up template endpoints
router.post("/reasons/:id/follow-up-templates", async (req, res) => {
  const reasonId = parseInt(req.params.id, 10);
  const { stepNumber, delayValue, delayUnit, subject, body, includeFooter } = req.body;
  const result = await db.insert(reasonFollowUpTemplatesTable).values({ reasonId, stepNumber, delayValue, delayUnit, subject, body, includeFooter: includeFooter ?? true });
  const insertId = (result as any)[0]?.insertId || result.lastID;
  const [template] = await db.select().from(reasonFollowUpTemplatesTable).where(eq(reasonFollowUpTemplatesTable.id, insertId));
  res.status(201).json(template);
  return;
});

router.put("/reasons/:id/follow-up-templates/:tid", async (req, res) => {
  const reasonId = parseInt(req.params.id, 10);
  const tid = parseInt(req.params.tid, 10);
  const { stepNumber, delayValue, delayUnit, subject, body, includeFooter } = req.body;
  await db
    .update(reasonFollowUpTemplatesTable)
    .set({ stepNumber, delayValue, delayUnit, subject, body, includeFooter })
    .where(and(eq(reasonFollowUpTemplatesTable.id, tid), eq(reasonFollowUpTemplatesTable.reasonId, reasonId)));
  const [template] = await db.select().from(reasonFollowUpTemplatesTable).where(and(eq(reasonFollowUpTemplatesTable.id, tid), eq(reasonFollowUpTemplatesTable.reasonId, reasonId)));
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(template);
  return;
});

router.delete("/reasons/:id/follow-up-templates/:tid", async (req, res) => {
  const reasonId = parseInt(req.params.id, 10);
  const tid = parseInt(req.params.tid, 10);
  const [template] = await db.select().from(reasonFollowUpTemplatesTable).where(and(eq(reasonFollowUpTemplatesTable.id, tid), eq(reasonFollowUpTemplatesTable.reasonId, reasonId)));
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  await db.delete(reasonFollowUpTemplatesTable).where(and(eq(reasonFollowUpTemplatesTable.id, tid), eq(reasonFollowUpTemplatesTable.reasonId, reasonId)));
  res.status(204).end();
  return;
});

// Email events endpoints
router.get("/campaigns/:id/recipients/:recipientId/events", async (req, res) => {
  const campaignId = parseInt(req.params.id, 10);
  const recipientId = parseInt(req.params.recipientId, 10);

  // Get all sent emails for this recipient
  const sentEmails = await db
    .select({ id: sentEmailsTable.id, messageId: sentEmailsTable.messageId, stepNumber: sentEmailsTable.stepNumber, sentAt: sentEmailsTable.sentAt })
    .from(sentEmailsTable)
    .where(eq(sentEmailsTable.recipientId, recipientId));

  if (sentEmails.length === 0) {
    return res.json([]);
  }

  // Get all events for these sent emails
  const emailIds = sentEmails.map((e: any) => e.id);
  const events = emailIds.length > 0 
    ? await db
        .select()
        .from(emailEventsTable)
        .where(sql`${emailEventsTable.sentEmailId} IN (${sql.raw(emailIds.map((id: any) => String(id)).join(","))})`)
        .orderBy(emailEventsTable.timestamp)
    : [];

  // Combine sent emails with their events
  const enrichedEmails = sentEmails.map((email: any) => {
    const emailEvents = events.filter((e: any) => e.sentEmailId === email.id);
    const openedEvent = emailEvents.find((e: any) => e.eventType === "opened");
    const clickedEvent = emailEvents.find((e: any) => e.eventType === "clicked");

    return {
      ...email,
      opened: !!openedEvent,
      openedAt: openedEvent?.timestamp,
      clicked: !!clickedEvent,
      clickedAt: clickedEvent?.timestamp,
      allEvents: emailEvents,
    };
  });

  return res.json(enrichedEmails);
});

// Search for recipients by name or email
router.get("/recipients", async (req, res) => {
  try {
    const results = await db
      .select({
        id: recipientsTable.id,
        name: recipientsTable.name,
        email: recipientsTable.email,
        campaignId: recipientsTable.campaignId,
        campaignName: campaignsTable.name,
        sentCount: sql<number>`(SELECT COUNT(*) FROM ${sentEmailsTable} WHERE ${sentEmailsTable.recipientId} = ${recipientsTable.id})`,
        initialSentAt: recipientsTable.initialSentAt,
      })
      .from(recipientsTable)
      .leftJoin(campaignsTable, eq(recipientsTable.campaignId, campaignsTable.id))
      .orderBy(recipientsTable.name);

    res.json(results);
    return;
  } catch (err) {
    console.error("[recipients] Error fetching recipients:", err);
    res.status(500).json({ error: "Failed to fetch recipients" });
    return;
  }
});

router.get("/search/recipients", async (req, res) => {
  const { q } = req.query;
  
  if (!q || typeof q !== "string" || q.trim().length === 0) {
    return res.json([]);
  }

  const searchTerm = `%${q.trim()}%`;

  try {
    const results = await db
      .select({
        id: recipientsTable.id,
        name: recipientsTable.name,
        email: recipientsTable.email,
        campaignId: recipientsTable.campaignId,
        campaignName: campaignsTable.name,
        sentCount: sql<number>`(SELECT COUNT(*) FROM ${sentEmailsTable} WHERE ${sentEmailsTable.recipientId} = ${recipientsTable.id})`,
        initialSentAt: recipientsTable.initialSentAt,
      })
      .from(recipientsTable)
      .leftJoin(campaignsTable, eq(recipientsTable.campaignId, campaignsTable.id))
      .where(
        sql`${recipientsTable.email} LIKE ${searchTerm} OR ${recipientsTable.name} LIKE ${searchTerm}`
      )
      .limit(20);

    return res.json(results);
  } catch (err) {
    console.error("[search] Error searching recipients:", err);
    return res.status(500).json({ error: "Failed to search recipients" });
  }
});

export default router;
