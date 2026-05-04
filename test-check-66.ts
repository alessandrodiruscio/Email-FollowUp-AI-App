import { shouldCampaignBeCompleted } from "./artifacts/api-server/src/routes/campaigns.js";
shouldCampaignBeCompleted(66).then(res => console.log("C66:", res)).finally(() => process.exit(0));
