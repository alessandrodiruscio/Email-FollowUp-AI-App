import { db, notificationsTable } from "./lib/db/src/index.js";
import { inArray } from "drizzle-orm";
async function deleteMismatch() {
  await db.delete(notificationsTable).where(
    inArray(notificationsTable.campaignId, [29, 51, 52, 71])
  );
  console.log("Deleted notification mismatch.");
}
deleteMismatch().finally(() => process.exit(0));
