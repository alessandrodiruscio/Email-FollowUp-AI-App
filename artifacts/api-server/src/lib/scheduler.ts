import { db, connectionError, campaignsTable, recipientsTable, followUpStepsTable, sentEmailsTable, notificationsTable } from "../../../../lib/db/src/index.js";
import { eq, and, sql } from "drizzle-orm";
import { sendEmail } from "./sendEmail.js";
import { substituteVariables } from "./variableSubstitution.js";
import { shouldCampaignBeCompleted, getCampaignCounts, getCampaignClickers } from "../routes/campaigns.js";

async function checkCompletedCampaigns() {
  if (!db || connectionError) return;

  try {
    const activeCampaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.status, "active"));
    
    for (const campaign of activeCampaigns) {
      const isCompleted = await shouldCampaignBeCompleted(campaign.id);
      
      if (isCompleted) {
        // Mark as completed
        await db.update(campaignsTable).set({ status: "completed", updatedAt: new Date() }).where(eq(campaignsTable.id, campaign.id));
        
        // Get counts
        const counts = await getCampaignCounts(campaign.id);
        
        // At least two clicks requirement
        if (counts.clickedCount >= 2) {
          console.log(`[scheduler] Campaign ${campaign.id} completed with >= 2 clicks. Sending notifications.`);
          
          try {
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
          } catch (e) {
            console.error("[scheduler] Error ensuring notifications table exists:", e);
          }
          
          const clickers = await getCampaignClickers(campaign.id);
          const clickersStr = clickers.map(c => `${c.name} (${c.email})`).join(", ");

          // 1. Notify inside the app
          await db.insert(notificationsTable).values({
            campaignId: campaign.id,
            title: `Campaign "${campaign.name}" Finished!`,
            message: `Your campaign has finished and received ${counts.clickedCount} clicks. Recipients who clicked: ${clickersStr || "None"}. Time to send an additional email!`
          });
          
          // 2. Receive an email (send it to the user's fromEmail, or whatever email we know)
          // The request doesn't specify which user, since the app doesn't have a users table, and sends via fromEmail
          // We will notify the \`fromEmail\` used in the campaign.
          await sendEmail({
             to: campaign.fromEmail,
             toName: campaign.fromName,
             from: process.env.RESEND_FROM_EMAIL || "notifications@mail.com", // Usually you have a system email
             fromName: "Email Followup App",
             subject: `🎉 Campaign "${campaign.name}" has finished!`,
             body: `Hello ${campaign.fromName},\n\nYour campaign "${campaign.name}" has officially finished sending all emails.\nIt received an impressive ${counts.clickedCount} clicks!\n\nRecipients who clicked: ${clickersStr || "None"}\n\nThis means it's a great time to reach out with an additional email to those recipients.\n\nBest,\nThe Team`,
             htmlBody: `<p>Hello ${campaign.fromName},</p><p>Your campaign "<b>${campaign.name}</b>" has officially finished sending all emails.</p><p>It received an impressive <b>${counts.clickedCount}</b> clicks!</p><p>Recipients who clicked: <b>${clickersStr || "None"}</b></p><p>This means it's a great time to reach out with an additional email to those recipients.</p><p>Best,<br>The Team</p>`
          });
        }
      }
    }
  } catch (err) {
    console.error("[scheduler] Error checking completed campaigns:", err);
  }
}

async function processFollowUps() {
  try {
    if (!db || connectionError) {
      // Silently return if connection error is already known or db is not initialized
      return;
    }
    
    const activeRecipients = await db
      .select({
        recipient: recipientsTable,
        campaign: campaignsTable,
      })
      .from(recipientsTable)
      .innerJoin(campaignsTable, eq(recipientsTable.campaignId, campaignsTable.id))
      .where(
        and(
          eq(recipientsTable.replied, false),
          sql`${recipientsTable.initialSentAt} IS NOT NULL`,
          eq(campaignsTable.status, "active")
        )
      );

    for (const { recipient, campaign } of activeRecipients) {
      const followUpSteps = await db
        .select()
        .from(followUpStepsTable)
        .where(eq(followUpStepsTable.campaignId, campaign.id))
        .orderBy(followUpStepsTable.stepNumber);

      const initialSentAt = recipient.initialSentAt!;

      // Compute cumulative delay for each step so sequence pacing is preserved.
      // Each step's wait is relative to the end of the previous one
      let cumulativeDelayMs = 0;

      for (const step of followUpSteps) {
        // Convert delay to milliseconds based on unit
        let stepDelayMs = 0;
        if (step.delayUnit === "minutes") {
          stepDelayMs = step.delayValue * 60 * 1000;
        } else if (step.delayUnit === "hours") {
          stepDelayMs = step.delayValue * 60 * 60 * 1000;
        } else if (step.delayUnit === "days") {
          stepDelayMs = step.delayValue * 24 * 60 * 60 * 1000;
        }
        cumulativeDelayMs += stepDelayMs;

        const successfullySent = await db
          .select({ id: sentEmailsTable.id })
          .from(sentEmailsTable)
          .where(
            and(
              eq(sentEmailsTable.recipientId, recipient.id),
              eq(sentEmailsTable.followUpStepId, step.id),
              eq(sentEmailsTable.status, "sent")
            )
          )
          .limit(1);

        if (successfullySent.length > 0) continue;

        const scheduledAt = new Date(initialSentAt.getTime() + cumulativeDelayMs);

        if (new Date() >= scheduledAt) {
          // Build footer for follow-up email if campaign has footer fields and step includes footer
          const followUpBody = step.body;
          let htmlFollowUpBody = step.body.replace(/\n/g, "<br/>");
          
          if (campaign.footerName && step.includeFooter) {
            // HTML footer with image on left, text on right (matching initial email layout)
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
            htmlFollowUpBody = htmlFollowUpBody + htmlFooter;
          }

          // Substitute variables in subject and body
          const substitutedSubject = substituteVariables(step.subject, {
            original_subject: campaign.subject,
            name: recipient.name,
            email: recipient.email,
            company: recipient.company || "",
          });
          const substitutedBody = substituteVariables(followUpBody, {
            original_subject: campaign.subject,
            name: recipient.name,
            email: recipient.email,
            company: recipient.company || "",
          });
          const substitutedHtmlBody = substituteVariables(htmlFollowUpBody, {
            original_subject: campaign.subject,
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

          await db.insert(sentEmailsTable).values({
            recipientId: recipient.id,
            followUpStepId: step.id,
            messageId: result.messageId,
            subject: step.subject,
            body: followUpBody,
            sentAt: new Date(),
            status: result.success ? "sent" : "failed",
            stepNumber: step.stepNumber,
          });

          if (result.success) {
            console.log(`[scheduler] Sent follow-up #${step.stepNumber} to ${recipient.email} for campaign "${campaign.name}"`);
          } else {
            console.error(`[scheduler] Failed to send follow-up #${step.stepNumber} to ${recipient.email}: ${result.error}`);
          }

          // Only send one follow-up per recipient per scheduler tick to avoid flooding
          break;
        }
      }
    }
  } catch (err) {
    // Only log if it's not a connection error (which we already know about)
    const errMsg = String(err);
    if (!errMsg.includes('ECONNREFUSED') && !errMsg.includes('Access denied')) {
      console.error("[scheduler] Error processing follow-ups:", err);
    }
  }
}

export function startScheduler() {
  const INTERVAL_MS = 60 * 1000;
  console.log("[scheduler] Follow-up scheduler started (interval: 60s)");
  // Don't call processFollowUps immediately on startup - let the pool initialize first
  // Initial error is typically due to startup race condition with database
  setInterval(async () => {
    await processFollowUps();
    await checkCompletedCampaigns();
  }, INTERVAL_MS);
}
