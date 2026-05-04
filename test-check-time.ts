import { db, sentEmailsTable, recipientsTable } from "./lib/db/src/index.js";
import { eq, and } from "drizzle-orm";

async function check() {
  const sents = await db.select().from(sentEmailsTable).where(
    and(eq(sentEmailsTable.recipientId, 84)) // Niels' recipient id
  );
  console.log(sents);
}
check().finally(() => process.exit(0));
