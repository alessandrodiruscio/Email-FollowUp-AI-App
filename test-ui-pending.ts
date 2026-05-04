import { db, recipientsTable, sentEmailsTable, followUpStepsTable } from "./lib/db/src/index.js";
import { eq } from "drizzle-orm";
async function checkPending() {
  for (let cid of [29, 51, 52, 53, 66, 71]) {
    const rs = await db.select().from(recipientsTable).where(eq(recipientsTable.campaignId, cid));
    const ss = await db.select().from(followUpStepsTable).where(eq(followUpStepsTable.campaignId, cid));
    for (let r of rs) {
      for (let s of ss) {
        const sents = await db.select().from(sentEmailsTable).where(eq(sentEmailsTable.recipientId, r.id));
        const wasSent = sents.some(e => e.followUpStepId === s.id && e.status === 'sent');
        const isCancelled = !wasSent && r.replied;
        const isPending = !wasSent && !r.replied && !!r.initialSentAt;
        if (isPending) {
           console.log(`Campaign ${cid} Recipient ${r.email} Step ${s.stepNumber} IS PENDING in UI!`);
        }
      }
    }
  }
}
checkPending().finally(()=>process.exit(0));
