import { db, followUpStepsTable, recipientsTable, sentEmailsTable, campaignsTable } from "./lib/db/src/index.js";
import { eq, and } from "drizzle-orm";
async function info() {
  for (let cid of [29, 51, 52, 53, 66, 71]) {
    const campaignList = await db.select().from(campaignsTable).where(eq(campaignsTable.id, cid));
    if (!campaignList.length) continue;
    const rs = await db.select().from(recipientsTable).where(eq(recipientsTable.campaignId, cid));
    const ss = await db.select().from(followUpStepsTable).where(eq(followUpStepsTable.campaignId, cid));
    console.log(`Campaign ${cid}: ${rs.length} recipients, ${ss.length} steps`);
    for (let r of rs) {
      if (r.replied) continue;
      if (!r.initialSentAt) console.log(`   - R ${r.email} hasn't started yet!!`);
    }
  }
}
info().finally(()=>process.exit(0));
