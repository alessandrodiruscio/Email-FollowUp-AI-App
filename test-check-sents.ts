import { db, sentEmailsTable, followUpStepsTable } from "./lib/db/src/index.js";
import { eq, inArray } from "drizzle-orm";

async function check() {
  const sents = await db.select().from(sentEmailsTable).where(
    inArray(sentEmailsTable.followUpStepId, [162, 163, 164])
  );
  console.log("Sent emails for 53 followups:");
  for (const s of sents) {
    console.log(`id: ${s.id}, rId: ${s.recipientId}, stepId: ${s.followUpStepId}, status: ${s.status}`);
  }
}
check().finally(() => process.exit(0));
