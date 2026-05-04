import { db, connectionError, campaignsTable, notificationsTable } from "../../../../lib/db/src/index.js";
import { getCampaignCounts, getCampaignClickers, shouldCampaignBeCompleted } from "../routes/campaigns.js";
import { eq, sql } from "drizzle-orm";

async function run() {
  if (connectionError || !db) {
    console.error("No DB connection");
    process.exit(1);
  }

  try {
    // Ensure table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        \`read\` BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const campaigns = await db.select().from(campaignsTable);
    console.log(`Checking ${campaigns.length} total campaigns for retroactive notifications...`);

    let newCount = 0;
    let deletedCount = 0;
    let revertedCount = 0;
    for (const campaign of campaigns) {
      const counts = await getCampaignCounts(campaign.id);
      const isCompleted = await shouldCampaignBeCompleted(campaign.id);
      
      if (!isCompleted && campaign.status === "completed") {
        console.log(`Reverting prematurely completed campaign ${campaign.id} to active`);
        await db.update(campaignsTable).set({ status: "active" }).where(eq(campaignsTable.id, campaign.id));
        revertedCount++;
      }

      const existing = await db.select().from(notificationsTable).where(eq(notificationsTable.campaignId, campaign.id));
      
      if (!isCompleted) {
        if (existing.length > 0) {
          console.log(`Deleting notification for uncompleted campaign ${campaign.id}`);
          await db.delete(notificationsTable).where(eq(notificationsTable.campaignId, campaign.id));
          deletedCount++;
        }
        continue;
      }
      
      if (counts.clickedCount >= 2) {
        // Check if a notification already exists for this campaign
        const clickers = await getCampaignClickers(campaign.id);
        const clickersStr = clickers.map(c => `${c.name} (${c.email})`).join(", ");

        if (existing.length === 0) {
          console.log(`Creating notification for past campaign ${campaign.id} (${campaign.name}) with ${counts.clickedCount} clicks`);
          await db.insert(notificationsTable).values({
            campaignId: campaign.id,
            title: `Campaign "${campaign.name}" Finished!`,
            message: `Your campaign has finished and received ${counts.clickedCount} clicks. Recipients who clicked: ${clickersStr || "None"}. Time to send an additional email!`
          });
          newCount++;
        } else {
          // Update the existing one just in case the backend already generated it without the clickers str
          if (!existing[0].message.includes("Recipients who clicked")) {
             console.log(`Updating notification for past campaign ${campaign.id} to include clickers list`);
             await db.update(notificationsTable).set({
               message: `Your campaign has finished and received ${counts.clickedCount} clicks. Recipients who clicked: ${clickersStr || "None"}. Time to send an additional email!`
             }).where(eq(notificationsTable.id, existing[0].id));
             newCount++;
          }
        }
      }
    }
    console.log(`Retroactive notifications complete. Created/Updated ${newCount} notifications. Deleted ${deletedCount} incorrect notifications. Reverted ${revertedCount} campaigns to active.`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

run();
