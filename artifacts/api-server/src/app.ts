import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { db, connectionError } from "../../../lib/db/src/index.js";
import fs from "fs";
import path from "path";
import router from "./routes/index.js";
import webhooksRouter from "./routes/webhooks.js";
import initRouter from "./routes/init.js";

// Try several potential locations for dist/public relative to process.cwd()
const rootPath = process.cwd();
const potentialDistPaths = [
  path.resolve(rootPath, "public"),
  path.resolve(rootPath, "dist/public"),
  path.resolve(rootPath, "artifacts/api-server/dist/public"),
  path.resolve(rootPath, "artifacts/email-followup/dist/public"),
];

let distPath = potentialDistPaths[0];
for (const p of potentialDistPaths) {
  if (fs.existsSync(p)) {
    distPath = p;
    break;
  }
}

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

app.get("/", (req, res) => {
  const indexPath = path.resolve(distPath, "index.html");
  console.log(`[app] GET / -> attempting to serve ${indexPath}`);
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  // Try fallback to root if distPath didn't work (Vercel quirks)
  const fallbackPath = path.resolve(process.cwd(), "index.html");
  if (fs.existsSync(fallbackPath)) {
    return res.sendFile(fallbackPath);
  }
  res.status(404).send(`Cannot find index.html at ${indexPath} or ${fallbackPath}. Current directory: ${process.cwd()}. Files: ${fs.readdirSync(process.cwd()).join(', ')}`);
});

app.get("/api", (req, res) => {
  return res.json({ status: "ok", message: "FollowUp AI API Service", version: "1.0.0" });
});

app.get("/api/env-check", (req, res) => {
  return res.json({ 
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV,
    distPath,
    exists: fs.existsSync(distPath),
    indexExists: fs.existsSync(path.join(distPath, "index.html"))
  });
});

app.get("/api/ping", (req, res) => {
  return res.json({ message: "pong", dbConnected: !!db });
});

// 112: Mount routes
app.use("/api", router);
app.use("/api", initRouter);

// 148: STATIC FILES & SPA FALLBACK (After API routes)
console.log(`[app] Final selected distPath: ${distPath}`);
console.log(`[app] distPath exists: ${fs.existsSync(distPath)}`);

// Serve static files from distPath
app.use(express.static(distPath));

// SPA fallback - Catch-all for frontend routes
app.use((req: Request, res: Response, next: NextFunction) => {
  // 1. Skip API calls
  if (req.path.startsWith("/api") || req.path.startsWith("/health") || req.path.startsWith("/reasons") || req.path.startsWith("/ping")) {
    return next();
  }
  
  // 2. Skip files with extensions
  if (req.path.includes(".") && !req.path.endsWith(".html")) {
    return next();
  }
  
  // 3. Serve index.html for everything else
  const indexPath = path.resolve(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  } else {
    console.warn(`[app] SPA fallback: index.html not found at ${indexPath}`);
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
