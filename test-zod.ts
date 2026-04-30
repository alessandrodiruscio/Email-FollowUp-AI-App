import { z } from "zod";
import { insertCampaignSchema } from "./lib/db/src/schema/campaigns";

console.log("Zod version:", (z as any).version || "unknown");
console.log("Schema exists:", !!insertCampaignSchema);

try {
  const result = insertCampaignSchema.parse({
    name: "Test",
    subject: "Sub",
    body: "Body",
    fromEmail: "test@example.com",
    fromName: "Test"
  });
  console.log("Parse success:", !!result);
} catch (e) {
  console.error("Parse failed:", e);
}
