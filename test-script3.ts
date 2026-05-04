import { db, campaignsTable } from "./lib/db/src/index.js";
import { shouldCampaignBeCompleted, getCampaignCounts } from "./artifacts/api-server/src/routes/campaigns.js";

async function run() {
  const campaigns = await db.select().from(campaignsTable);
  for (const c of campaigns) {
    const counts = await getCampaignCounts(c.id);
    if (counts.clickedCount >= 2) {
      const isCompleted = await shouldCampaignBeCompleted(c.id);
      console.log(`Campaign ${c.id}: name="${c.name}", clicks=${counts.clickedCount}, status=${c.status}, isCompleted=${isCompleted}`);
    }
  }
  process.exit(0);
}
run();
