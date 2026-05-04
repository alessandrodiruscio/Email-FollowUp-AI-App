import { db, notificationsTable } from "./lib/db/src/index.js";

async function run() {
  const notifs = await db.select().from(notificationsTable);
  console.log(notifs);
  process.exit(0);
}
run();
