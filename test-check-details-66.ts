import { db, followUpStepsTable, recipientsTable, sentEmailsTable } from "./lib/db/src/index.js";
import { and, eq, count } from "drizzle-orm";

async function debug() {
  const recipients = await db
    .select({ id: recipientsTable.id, initialSentAt: recipientsTable.initialSentAt, email: recipientsTable.email })
    .from(recipientsTable)
    .where(
      and(
        eq(recipientsTable.campaignId, 66),
        eq(recipientsTable.replied, false)
      )
    );

  const followUpSteps = await db
    .select({ id: followUpStepsTable.id, stepNumber: followUpStepsTable.stepNumber })
    .from(followUpStepsTable)
    .where(eq(followUpStepsTable.campaignId, 66));

  for (const recipient of recipients) {
      for (const step of followUpSteps) {
        const [sentResult] = await db
          .select({ count: count() })
          .from(sentEmailsTable)
          .where(
            and(
              eq(sentEmailsTable.recipientId, recipient.id),
              eq(sentEmailsTable.followUpStepId, step.id),
              eq(sentEmailsTable.status, "sent")
            )
          );
        console.log(`R ${recipient.email} Step ${step.id}: `, sentResult);
      }
  }
}
debug().finally(() => process.exit(0));
