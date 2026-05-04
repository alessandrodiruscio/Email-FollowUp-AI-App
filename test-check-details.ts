import { db, followUpStepsTable, recipientsTable, sentEmailsTable } from "./lib/db/src/index.js";
import { and, eq, count } from "drizzle-orm";

async function debug() {
  const recipients = await db
    .select({ id: recipientsTable.id, initialSentAt: recipientsTable.initialSentAt, email: recipientsTable.email })
    .from(recipientsTable)
    .where(
      and(
        eq(recipientsTable.campaignId, 53),
        eq(recipientsTable.replied, false)
      )
    );

  const followUpSteps = await db
    .select({ id: followUpStepsTable.id, stepNumber: followUpStepsTable.stepNumber })
    .from(followUpStepsTable)
    .where(eq(followUpStepsTable.campaignId, 53));

  console.log("Active Recipients:", recipients);
  console.log("Follow up steps:", followUpSteps);

  for (const recipient of recipients) {
      if (!recipient.initialSentAt) console.log(recipient.email, "missing initial_sent_at");

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
        
        if (!sentResult || sentResult.count === 0) {
           console.log(`Recipient ${recipient.email} missing step ID ${step.id} (stepNumber ${step.stepNumber})`);
        }
      }
  }
}
debug().finally(() => process.exit(0));
