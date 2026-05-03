import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { db, connectionError } from "../../../lib/db/src/index.js";
import fs from "fs";
import path from "path";
import router from "./routes/index.js";
import webhooksRouter from "./routes/webhooks.js";
import initRouter from "./routes/init.js";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootPath = process.cwd();
console.log(`[app] Runtime context: cwd=${rootPath}, dirname=${__dirname}`);

const potentialDistPaths = [
  path.resolve(rootPath, "dist/public"),
  path.resolve(rootPath, "public"),
  path.resolve(rootPath), 
  path.resolve(__dirname, "../../../dist/public"), // UP FROM artifacts/api-server/src
  path.resolve(__dirname, "../../../../dist/public"), // UP FROM api/index.ts if it was there
  path.resolve(__dirname, "../dist/public"),
  path.resolve(rootPath, "api/dist/public"),
];

let distPath = potentialDistPaths[0];
for (const p of potentialDistPaths) {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      const children = fs.readdirSync(p);
      if (children.includes("index.html") || children.includes("assets")) {
        distPath = p;
        break;
      }
    }
  } catch (e) {
    // ignore
  }
}

const app: Express = express();

// ABSOLUTE HIGHEST PRIORITY PING
app.all("/__server_ping", (req, res) => {
  console.log(`[PING-INTERNAL] Hit from ${req.headers.host}`);
  res.status(200).send("PONG-FROM-SERVER");
});

// ROOT HANDLER FOR CONNECTIVITY TEST
app.get("/_test_root", (req, res) => {
  res.status(200).send("ROOT-REACHABLE");
});

// 0. CORS and BASIC MIDDLEWARE
// Enable CORS for all origins to ensure cross-app testing works
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}) as any);

// ABSOLUTE PRIORITY LOGGING FOR DEBUGGING
app.use((req, res, next) => {
  console.log(`[REQ-START] ${req.method} ${req.url} (Host: ${req.headers.host}, UA: ${req.headers['user-agent']?.substring(0, 50)})`);
  
  // Track long-running requests
  const timer = setTimeout(() => {
    console.warn(`[REQ-STALL] Request ${req.method} ${req.url} has been pending for over 5s`);
  }, 5000);

  res.on('finish', () => {
    clearTimeout(timer);
    console.log(`[REQ-END] ${req.method} ${req.url} -> ${res.statusCode}`);
  });
  next();
});

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

// BULLETPROOF endpoint to fix the 404 error
app.get("/api/dashboard/webhook-debug", async (req, res) => {
  try {
    const { webhookLogsTable } = await import("../../../lib/db/src/index.js");
    const { desc } = await import("drizzle-orm");
    const logs = await db
      .select()
      .from(webhookLogsTable)
      .orderBy(desc(webhookLogsTable.receivedAt))
      .limit(50);
    return res.json(logs);
  } catch (error: any) {
    return res.json([]);
  }
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
  
  if (req.method === "POST" || (req.path && req.path.includes("webhook"))) {
    console.log(`[REQ-${requestId}] ${req.method} ${req.originalUrl} from ${req.ip}`);
  }
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.method === "POST" || (req.path && req.path.includes("webhook"))) {
      console.log(`[REQ-${requestId}] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  return res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/env-check", (req, res) => {
  return res.json({ 
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV,
    distPath,
    exists: fs.existsSync(distPath),
    indexExists: fs.existsSync(path.join(distPath, "index.html")),
    __dirname: __dirname
  });
});

app.get("/api/ping", (req, res) => {
  return res.json({ message: "pong", dbConnected: !!db });
});

// 112: Mount routes
app.get("/debug-api", (req, res) => res.json({ debug: true, routerKeys: Object.keys(router), originalUrl: req.originalUrl }));

app.use("/api", router);
app.use("/api", initRouter);

// Fallback for Vercel and production deployment
if (fs.existsSync(distPath) && fs.statSync(distPath).isDirectory()) {
  console.log(`[app] Serving static from ${distPath}`);
  app.use(express.static(distPath));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/health") || req.path.startsWith("/ping") || req.path.startsWith("/w") || req.path.startsWith("/webhook") || req.path.startsWith("/vercel-debug")) return next();
    if (req.path.includes(".")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  console.log(`[app] WARNING: distPath not found! Tried: ${potentialDistPaths.join(', ')}`);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/health") || req.path.startsWith("/ping") || req.path.startsWith("/w") || req.path.startsWith("/webhook") || req.path.startsWith("/vercel-debug")) return next();
    res.status(404).send(`Cannot GET ${req.path} - Front-end build not found at any of the potential paths. Environment: cwd=${process.cwd()}, dirname=${__dirname}`);
  });
}

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
