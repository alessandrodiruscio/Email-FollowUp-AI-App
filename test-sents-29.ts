import { db, recipientsTable, sentEmailsTable, followUpStepsTable } from "./lib/db/src/index.js";
import { eq, and } from "drizzle-orm";
async function info() {
  for (let cid of [29, 51]) {
    const rs = await db.select().from(recipientsTable).where(eq(recipientsTable.campaignId, cid));
    for (let r of rs) {
      const sents = await db.select().from(sentEmailsTable).where(eq(sentEmailsTable.recipientId, r.id));
      console.log(`C${cid} R ${r.email}: sent emails = ${sents.length}`);
    }
  }
}
info().finally(()=>process.exit(0));
