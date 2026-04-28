import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { db, connectionError } from "../../../lib/db/src/index";
import router from "./routes/index";
import webhooksRouter from "./routes/webhooks";
import initRouter from "./routes/init";

const app: Express = express();

app.set('strict routing', false);

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 1. WEBHOOKS FIRST - Absolute priority to avoid any redirects or auth middleware
app.use("/webhooks", webhooksRouter);
app.use("/api/webhooks", webhooksRouter);

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
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  if (req.method === "POST" || req.path.includes("webhook")) {
    console.log(`[REQ-${requestId}] ${req.method} ${req.originalUrl} from ${req.ip}`);
    console.log(`[REQ-${requestId}] Headers: ${JSON.stringify(req.headers)}`);
  }
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.method === "POST" || req.path.includes("webhook")) {
      console.log(`[REQ-${requestId}] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  
  next();
});

// Test health endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/ping", (req, res) => {
  res.json({ message: "pong", dbConnected: !!db });
});

// Mount routes
app.use("/api", router);
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
