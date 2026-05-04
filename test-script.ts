import { db, campaignsTable } from "./lib/db/src/index.js";
import { shouldCampaignBeCompleted } from "./artifacts/api-server/src/routes/campaigns.js";

async function run() {
  const campaigns = await db.select().from(campaignsTable);
  for (const c of campaigns) {
    if ([29, 51, 52, 53, 66, 71].includes(c.id)) {
      const isCompleted = await shouldCampaignBeCompleted(c.id);
      console.log(`Campaign ${c.id}: status=${c.status}, isCompleted=${isCompleted}`);
    }
  }
  process.exit(0);
}
run();
