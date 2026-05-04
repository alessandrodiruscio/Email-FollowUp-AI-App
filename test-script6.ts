import { db, recipientsTable, sentEmailsTable, followUpStepsTable } from "./lib/db/src/index.js";
import { eq, and } from "drizzle-orm";

async function checkPending() {
  for (const cid of [29, 51, 52, 53, 66, 71]) {
    const recipients = await db.select().from(recipientsTable).where(eq(recipientsTable.campaignId, cid));
    const steps = await db.select().from(followUpStepsTable).where(eq(followUpStepsTable.campaignId, cid));
    for (const r of recipients) {
      if (r.replied) continue;
      for (const step of steps) {
        const sent = await db.select().from(sentEmailsTable).where(
          and(
            eq(sentEmailsTable.recipientId, r.id),
            eq(sentEmailsTable.followUpStepId, step.id)
          )
        );
        if (sent.length === 0) {
          console.log(`Campaign ${cid}: Recipient ${r.email} is missing step ${step.stepNumber}`);
        }
      }
    }
  }
}
checkPending().then(() => process.exit(0));
