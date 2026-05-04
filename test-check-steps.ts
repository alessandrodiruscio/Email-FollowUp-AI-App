import { db, followUpStepsTable } from "./lib/db/src/index.js";
import { eq } from "drizzle-orm";

async function check() {
  const steps = await db.select().from(followUpStepsTable).where(eq(followUpStepsTable.campaignId, 66));
  console.log("Steps for 66:");
  console.log(steps);

  const steps53 = await db.select().from(followUpStepsTable).where(eq(followUpStepsTable.campaignId, 53));
  console.log("Steps for 53:");
  console.log(steps53);
}
check().finally(() => process.exit(0));
