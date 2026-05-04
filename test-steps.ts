import { db, recipientsTable, campaignsTable, followUpStepsTable } from "./lib/db/src/index.js";
import { eq } from "drizzle-orm";
async function info() {
  for (let cid of [29, 51, 52, 53, 66, 71]) {
    const rs = await db.select().from(recipientsTable).where(eq(recipientsTable.campaignId, cid));
    const ss = await db.select().from(followUpStepsTable).where(eq(followUpStepsTable.campaignId, cid));
    console.log(`Campaign ${cid} has ${ss.length} total steps`);
  }
}
info().finally(()=>process.exit(0));
