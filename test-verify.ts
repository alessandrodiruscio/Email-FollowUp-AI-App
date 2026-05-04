import { db, followUpStepsTable, recipientsTable, sentEmailsTable, campaignsTable } from "./lib/db/src/index.js";
import { eq, and } from "drizzle-orm";
async function verify() {
  for (let cid of [29, 51, 52, 53, 66, 71]) {
    const rs = await db.select().from(recipientsTable).where(eq(recipientsTable.campaignId, cid));
    const ss = await db.select().from(followUpStepsTable).where(eq(followUpStepsTable.campaignId, cid));
    let allGood = true;
    for (let r of rs) {
      if (r.replied) continue;
      for (let s of ss) {
         const sents = await db.select().from(sentEmailsTable).where(and(eq(sentEmailsTable.recipientId, r.id), eq(sentEmailsTable.followUpStepId, s.id), eq(sentEmailsTable.status, "sent")));
         if (sents.length === 0) {
            console.log(`Campaign ${cid} has missing step! Recipient: ${r.email}, Step: ${s.stepNumber}`);
            allGood = false;
         }
      }
    }
    if (allGood) console.log(`Campaign ${cid} is TRULY completed.`);
  }
}
verify().finally(()=>process.exit(0));
