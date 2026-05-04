import { db, connectionError, followUpStepsTable, recipientsTable, sentEmailsTable } from "./lib/db/src/index.js";
import { eq, and, count } from "drizzle-orm";

async function run(campaignId) {
  const [followUpCount] = await db
    .select({ count: count() })
    .from(followUpStepsTable)
    .where(eq(followUpStepsTable.campaignId, campaignId));
  
  const totalStepsPerRecipient = (followUpCount?.count ?? 0) + 1; // +1 for initial email
  
  // Get total recipients count
  const [recipientsResult] = await db
    .select({ count: count() })
    .from(recipientsTable)
    .where(eq(recipientsTable.campaignId, campaignId));
  const recipientCount = recipientsResult?.count ?? 0;
  
  const [sentResult] = await db
    .select({ count: count() })
    .from(sentEmailsTable)
    .innerJoin(recipientsTable, eq(sentEmailsTable.recipientId, recipientsTable.id))
    .where(
      and(
        eq(recipientsTable.campaignId, campaignId),
        eq(sentEmailsTable.status, "sent")
      )
    );
  const totalSentEmails = sentResult?.count ?? 0;
  
  console.log({ totalStepsPerRecipient, recipientCount, totalSentEmails, expected: recipientCount * totalStepsPerRecipient });
  process.exit(0);
}

run(71);
