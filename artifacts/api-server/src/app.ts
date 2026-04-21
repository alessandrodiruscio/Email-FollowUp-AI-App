import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { db, connectionError } from "@workspace/db";
import router from "./routes";
import webhooksRouter from "./routes/webhooks";
import initRouter from "./routes/init";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database readiness check for API routes
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (!db) {
    res.status(503).json({
      error: "Database not initialized",
      message: connectionError?.message || "DATABASE_URL is missing. Please set it in the Secrets panel."
    });
    return;
  }
  next();
});

// Global request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} (raw path: ${req.originalUrl})`);
  if ((req.method === "POST" || req.method === "PUT") && req.body) {
    const bodyStr = JSON.stringify(req.body);
    console.log("Body:", bodyStr.substring(0, 300));
  }
  next();
});

// Test health endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", router);
app.use("/api/webhooks", webhooksRouter);
app.use("/api", initRouter);

interface ZodIssue {
  path: (string | number)[];
  message: string;
}

function isZodError(err: unknown): err is { issues: ZodIssue[] } {
  return (
    typeof err === "object" &&
    err !== null &&
    "issues" in err &&
    Array.isArray((err as { issues: unknown }).issues)
  );
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (isZodError(err)) {
    res.status(400).json({
      error: "Validation error",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[app] Unhandled error:", err);
  res.status(500).json({ error: message });
});

export default app;
