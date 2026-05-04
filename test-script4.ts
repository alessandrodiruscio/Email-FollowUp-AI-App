import { db, campaignsTable, recipientsTable, sentEmailsTable, followUpStepsTable } from "./lib/db/src/index.js";
import { eq, and, count } from "drizzle-orm";

async function checkCompletionLogic() {
  const campaigns = await db.select().from(campaignsTable);
  for (const c of campaigns) {
    if (![29, 51, 52, 53, 66, 71].includes(c.id)) continue;
    const [followUpCount] = await db.select({ count: count() }).from(followUpStepsTable).where(eq(followUpStepsTable.campaignId, c.id));
    const totalSteps = followUpCount.count + 1;
    
    const recipients = await db.select().from(recipientsTable).where(eq(recipientsTable.campaignId, c.id));
    
    let allFinished = true;
    for (const r of recipients) {
      if (r.replied) continue; // no more emails for this recipient
      
      const [sentCount] = await db.select({ count: count() }).from(sentEmailsTable).where(eq(sentEmailsTable.recipientId, r.id));
      if (sentCount.count < totalSteps) {
         allFinished = false;
         console.log(`Campaign ${c.id}: recipient ${r.email} only received ${sentCount.count}/${totalSteps} emails.`);
      }
    }
    
    if (!allFinished) {
      console.log(`Campaign ${c.id}: Still has more emails to send.`);
    } else {
      console.log(`Campaign ${c.id}: Actually finished for all non-replied recipients.`);
    }
  }
}
checkCompletionLogic().then(() => process.exit(0));
