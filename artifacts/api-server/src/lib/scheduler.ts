import { db, connectionError, campaignsTable, recipientsTable, followUpStepsTable, sentEmailsTable } from "../../../../lib/db/src/index";
import { eq, and, sql } from "drizzle-orm";
import { sendEmail } from "./sendEmail";
import { substituteVariables } from "./variableSubstitution";

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
          let followUpBody = step.body;
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
  setInterval(processFollowUps, INTERVAL_MS);
}
