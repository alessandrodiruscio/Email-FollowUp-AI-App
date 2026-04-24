import { Router, type IRouter } from "express";
import healthRouter from "./health.ts";
import campaignsRouter from "./campaigns.ts";
import aiRouter from "./ai.ts";
import dashboardRouter from "./dashboard.ts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(campaignsRouter);
router.use(aiRouter);
router.use(dashboardRouter);

export default router;
