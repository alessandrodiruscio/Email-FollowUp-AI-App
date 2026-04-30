import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { db, connectionError } from "../../../lib/db/src/index.js";
import router from "./routes/index.js";
import webhooksRouter from "./routes/webhooks.js";
import initRouter from "./routes/init.js";

const app: Express = express();

// 0. CORS and BASIC MIDDLEWARE
// Enable CORS for all origins to ensure cross-app testing works
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}) as any);

// ABSOLUTE PRIORITY HEALTH CHECK
app.get("/public-health-check", (req, res) => {
  console.log(`[HEALTH] Public check from ${req.headers.host}`);
  return res.status(200).send("OK-SERVER-IS-UP");
});

// 0. LOGGING
app.use((req, res, next) => {
  console.log(`[HTTP-IN] ${req.method} ${req.url} (Host: ${req.headers.host})`);
  next();
});

app.use(cookieParser() as any);
app.use(express.json({ limit: '50mb' }) as any);
app.use(express.urlencoded({ extended: true, limit: '50mb' }) as any);

// 1. DIRECT ROUTES (Highest Priority)
app.all("/p", (req, res) => {
  return res.json({ status: "ok" });
});
app.all("/ping", (req, res) => {
  console.log(`[HEALTH-CHECK] Hit! Method: ${req.method} | Path: ${req.path} | Original: ${req.originalUrl} | Host: ${req.headers.host}`);
  return res.json({ 
    status: "ok", 
    message: "Server is alive and receiving requests",
    time: new Date().toISOString(), 
    auth: !!req.headers.authorization
  });
});
app.all("/ping-public", (req, res) => {
  return res.json({ status: "ok" });
});
app.all("/api/ping-public", (req, res) => {
  return res.json({ status: "ok" });
});

// 2. WEBHOOKS MOUNTING
// Mounting on multiple paths to handle various proxy/sharing scenarios
app.use((req, res, next) => {
  if (req.path.startsWith("/w") || req.path.includes("webhook")) {
    console.log(`[HTTP-WEBHOOK] Target: ${req.path} | Method: ${req.method} | Content-Type: ${req.headers["content-type"]}`);
  }
  next();
});

app.use("/w", webhooksRouter);
app.use("/public/webhook", webhooksRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/public/webhook", webhooksRouter);
app.use("/webhook-receiver", webhooksRouter);

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
  return res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/ping", (req, res) => {
  return res.json({ message: "pong", dbConnected: !!db });
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
