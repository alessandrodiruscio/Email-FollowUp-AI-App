import { db, count, eq, and, followUpStepsTable, recipientsTable, sentEmailsTable } from "./artifacts/api-server/src/routes/campaigns.js";
import { db as dbIndex } from "./lib/db/src/index.js";

async function debug(campaignId) {
  const [followUpCount] = await dbIndex.select({ count: count() }).from(followUpStepsTable).where(eq(followUpStepsTable.campaignId, campaignId));
  const totalStepsPerRecipient = (followUpCount?.count ?? 0) + 1; // +1 for initial email
  
  const [recipientsResult] = await dbIndex.select({ count: count() }).from(recipientsTable).where(eq(recipientsTable.campaignId, campaignId));
  const recipientCount = recipientsResult?.count ?? 0;
  
  const [sentResult] = await dbIndex.select({ count: count() }).from(sentEmailsTable)
    .innerJoin(recipientsTable, eq(sentEmailsTable.recipientId, recipientsTable.id))
    .where(and(eq(recipientsTable.campaignId, campaignId), eq(sentEmailsTable.status, "sent")));
  const totalSentEmails = sentResult?.count ?? 0;
  
  const expectedTotalEmails = recipientCount * totalStepsPerRecipient;
  console.log(`Campaign ${campaignId}`, { totalStepsPerRecipient, recipientCount, totalSentEmails, expectedTotalEmails });
}
dbIndex.select().from(recipientsTable).limit(1).then(() => Promise.all([debug(53), debug(66)]).then(() => process.exit(0)));
