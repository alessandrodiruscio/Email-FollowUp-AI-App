import { db, followUpStepsTable, recipientsTable, sentEmailsTable } from "./lib/db/src/index.js";
import { and, eq, count } from "drizzle-orm";

async function check() {
  const [res] = await db.select({ c: count() }).from(sentEmailsTable).where(eq(sentEmailsTable.id, 999999));
  console.log("Count for non-existent:", res.c, typeof res.c);
}
check().finally(() => process.exit(0));
