import { db as dbIndex, sentEmailsTable, recipientsTable } from "./lib/db/src/index.js";
import { eq } from "drizzle-orm";
async function viewSent() {
  const rs = await dbIndex.select().from(recipientsTable).where(eq(recipientsTable.campaignId, 66));
  for (const r of rs) {
    const sents = await dbIndex.select().from(sentEmailsTable).where(eq(sentEmailsTable.recipientId, r.id));
    console.log(`C66: r=${r.id} sum=${sents.length}`, sents.map(s => `step=${s.followUpStepId} status=${s.status}`));
  }
}
viewSent().then(() => process.exit(0));
