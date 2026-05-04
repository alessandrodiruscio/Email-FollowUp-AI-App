import { db, recipientsTable } from "./lib/db/src/index.js";
import { eq } from "drizzle-orm";
async function info() {
  for (let cid of [29, 51, 52, 53, 66, 71]) {
    const rs = await db.select().from(recipientsTable).where(eq(recipientsTable.campaignId, cid));
    for (let r of rs) {
      if (r.replied) console.log(`Campaign ${cid} has a REPLIED recipient: ${r.email}`);
    }
  }
}
info().finally(()=>process.exit(0));
