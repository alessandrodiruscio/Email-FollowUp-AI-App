import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "../../../../lib/api-zod/src/index";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  return res.json(data);
});

export default router;
