import { shouldCampaignBeCompleted } from "./artifacts/api-server/src/routes/campaigns.js";
shouldCampaignBeCompleted(53).then(res => console.log("Campaign 53 isCompleted:", res)).finally(() => process.exit(0));
