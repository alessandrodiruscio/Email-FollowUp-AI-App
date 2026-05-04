import { db, campaignsTable, followUpStepsTable, recipientsTable, sentEmailsTable } from "./lib/db/src/index.js";
import { getCampaignCounts } from "./artifacts/api-server/src/routes/campaigns.js";
import { count, eq, and } from "drizzle-orm";

async function check() {
  const campaigns = await db.select().from(campaignsTable);
  for (const c of campaigns) {
    const counts = await getCampaignCounts(c.id);
    if (counts.clickedCount >= 2) {
      console.log(`\nCampaign ${c.id} "${c.name}", Clicks: ${counts.clickedCount}, CurrentStatus: ${c.status}`);
      const steps = await db.select().from(followUpStepsTable).where(eq(followUpStepsTable.campaignId, c.id));
      const recipients = await db.select().from(recipientsTable).where(and(eq(recipientsTable.campaignId, c.id), eq(recipientsTable.replied, false)));
      
      let fullyComplete = true;
      for (const r of recipients) {
         if (!r.initialSentAt) {
           console.log(`Recipient ${r.email} missing initial email`);
           fullyComplete = false;
         }
         for (const s of steps) {
            const [sent] = await db.select({c: count()}).from(sentEmailsTable).where(and(
               eq(sentEmailsTable.recipientId, r.id),
               eq(sentEmailsTable.followUpStepId, s.id),
               eq(sentEmailsTable.status, "sent")
            ));
            if (sent.c === 0) {
               console.log(`Recipient ${r.email} missing step ${s.stepNumber}`);
               fullyComplete = false;
            }
         }
      }
      console.log(`FullyComplete evaluated here: ${fullyComplete}`);
    }
  }
}
check().finally(() => process.exit(0));
