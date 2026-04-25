import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import campaignsRouter from "./campaigns.js";
import aiRouter from "./ai.js";
import dashboardRouter from "./dashboard.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(campaignsRouter);
router.use(aiRouter);
router.use(dashboardRouter);

export default router;
