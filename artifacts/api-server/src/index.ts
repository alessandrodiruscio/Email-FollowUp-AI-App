import express from "express";
import path from "path";
import fs from "fs";

/**
 * server/index.ts
 * 
 * Minimalist entry point to ensure the port is bound immediately.
 */

const port = 3000;
const app = express();

// Set default headers for all responses to avoid encoding issues
app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'FollowUpAI-Core');
  next();
});

// 1. BOUND IMMEDIATELY to satisfy AI Studio health checks
app.listen(port, "0.0.0.0", () => {
  console.log(`[INIT] Port ${port} bound. Starting background bootstrap...`);
});

// 2. IMMEDIATE HEALTH CHECKS
app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/ping", (req, res) => res.status(200).send("PONG"));

let isReady = false;
let initError: any = null;
let bootProgress: string[] = ["Server starting..."];

const logProgress = (msg: string) => {
  console.log(`[BOOT] ${msg}`);
  bootProgress.push(`${new Date().toLocaleTimeString()}: ${msg}`);
};

// 3. BOOTSTRAP HANDLER (Root)
app.get("/", (req, res, next) => {
  if (isReady) return next();
  
  if (initError) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>FollowUp AI | Error</title></head>
      <body style="font-family: monospace; padding: 40px; background: #fff5f5; color: #c53030;">
        <h1>Initialization Failed</h1>
        <p>The application encountered a critical error during startup:</p>
        <pre style="background: #fff; padding: 20px; border-radius: 4px; border: 1px solid #feb2b2; overflow: auto;">${initError.stack || initError}</pre>
        <p>Please check the logs or contact support.</p>
      </body>
      </html>
    `);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="refresh" content="3">
      <title>Starting FollowUp AI...</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
        .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); text-align: center; max-width: 450px; width: 90%; }
        h1 { margin: 0 0 1rem; font-size: 1.5rem; letter-spacing: -0.025em; }
        p { margin: 0; color: #64748b; font-size: 0.95rem; line-height: 1.6; }
        .spinner { border: 3px solid #f1f5f9; border-top: 3px solid #3b82f6; border-radius: 50%; width: 28px; height: 28px; animation: spin 0.8s linear infinite; margin: 1.5rem auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .progress { text-align: left; margin-top: 1.5rem; font-size: 0.75rem; color: #94a3b8; font-family: monospace; max-height: 100px; overflow: hidden; opacity: 0.7; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>FollowUp AI is starting up...</h1>
        <div class="spinner"></div>
        <p>Preparing application assets and connecting to data services. This page will reload automatically in a few seconds.</p>
        <div class="progress">
          ${bootProgress.slice(-3).map(m => `<div>> ${m}</div>`).join('')}
        </div>
      </div>
    </body>
    </html>
  `);
});

async function bootstrap() {
  logProgress("Beginning asynchronous initialization...");
  try {
    // 1. Load env
    logProgress("Loading environment variables...");
    await import("./env.js");

    // 2. Load real app
    logProgress("Importing main application logic...");
    const { default: realApp } = await import("./app.js");
    app.use(realApp);
    logProgress("Backend routes mounted.");

    const rootPath = process.cwd();
    const distPath = path.resolve(rootPath, "dist/public");
    const vitePath = path.resolve(rootPath, "artifacts/email-followup");
    const indexHtmlPath = path.join(distPath, "index.html");
    const hasStatic = fs.existsSync(indexHtmlPath);

    if (hasStatic) {
      logProgress(`Assets found in ${distPath}. Serving as static.`);
      app.use(express.static(distPath));
      app.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        // Only fallback to index.html for non-API/non-asset routes
        if (req.path.startsWith("/api") || req.path.startsWith("/health") || req.path.startsWith("/ping")) return next();
        if (req.path.includes(".")) return next();
        res.sendFile(indexHtmlPath);
      });
    } else {
      logProgress("Static assets missing. Falling back to Vite development mode...");
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa",
        root: vitePath
      });
      app.use(vite.middlewares);
      logProgress("Vite middleware attached.");
    }

    // 3. Initialize background services
    try {
      logProgress("Starting background scheduler...");
      const { startScheduler } = await import("./lib/scheduler.js");
      startScheduler();
    } catch (e) {
      console.warn("Scheduler start failed:", e);
    }

    isReady = true;
    logProgress("Initialization complete. System ready.");
  } catch (err) {
    console.error("[BOOT_CRITICAL]", err);
    initError = err;
    logProgress(`CRITICAL ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }
}

bootstrap();
