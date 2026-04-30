import "./env";
import express from "express";
import path from "path";
import fs from "fs";
import app from "./app";
import { startScheduler } from "./lib/scheduler";

async function main() {
  console.log("[server] Starting server initialization...");
  
  // In AI Studio, we need to handle paths carefully between dev and prod
  const isProd = process.env.NODE_ENV === "production";
  
  // Handling global process errors
  process.on("unhandledRejection", (reason, promise) => {
    console.error("[process] Unhandled Rejection at:", promise, "reason:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[process] Uncaught Exception thrown:", err);
    // On some environments we might want to exit, but let's just log and try to continue for now
    // unless it's critical. 
  });

  // Try multiple ways to find the project root
  const rootPath = process.cwd();
  
  // Try several potential locations for dist/public
  const potentialDistPaths = [
    path.resolve(rootPath, "dist/public"),
    path.resolve(rootPath, "artifacts/api-server/dist/public"),
    path.resolve(rootPath, "artifacts/email-followup/dist/public"),
    path.resolve(rootPath, "public"),
  ];
  
  let distPath = potentialDistPaths[0];
  for (const p of potentialDistPaths) {
    if (fs.existsSync(p)) {
      distPath = p;
      break;
    }
  }
  
  // Also keep track of the source path just in case
  const vitePath = path.resolve(rootPath, "artifacts/email-followup");
  
  console.log(`[server] Env: ${process.env.NODE_ENV}`);
  console.log(`[server] Root path (cwd): ${rootPath}`);
  console.log(`[server] Static dist path: ${distPath}`);
  console.log(`[server] Vite source path: ${vitePath}`);

  const port = 3000;

  // Diagnostic route
  app.get("/__diagnostic", (req, res) => {
    const diagnostic = {
      isProd,
      env: process.env.NODE_ENV,
      cwd: process.cwd(),
      __dirname: typeof __dirname !== 'undefined' ? __dirname : 'not-defined',
      rootPath,
      vitePath,
      distPath,
      distExists: fs.existsSync(distPath),
      indexExists: fs.existsSync(path.join(distPath, "index.html")),
      assetsExists: fs.existsSync(path.join(distPath, "assets")),
      distFiles: [] as string[],
      assetsFiles: [] as string[],
      timestamp: new Date().toISOString()
    };
    
    if (diagnostic.distExists) {
      try {
        diagnostic.distFiles = fs.readdirSync(distPath);
        const assetsPath = path.join(distPath, "assets");
        if (fs.existsSync(assetsPath)) {
          diagnostic.assetsFiles = fs.readdirSync(assetsPath);
        }
      } catch (e: any) {
        diagnostic.distFiles = [String(e)];
      }
    }
    
    return res.json(diagnostic);
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
      root: vitePath
    });
    console.log("[server] Vite server created in SPA mode.");
    app.use(vite.middlewares);
    console.log("[server] Vite middlewares mounted.");
  } else {
    console.log(`[server] Serving static from ${distPath}`);
    if (!fs.existsSync(distPath)) {
      console.warn(`[server] WARNING: Static directory does not exist: ${distPath}`);
    }
    
    // Serve static files from distPath
    app.use(express.static(distPath));
    
    // API 404s
    app.use("/api", (req, res) => {
      return res.status(404).json({ error: "API endpoint not found" });
    });

    // SPA fallback - Safe catch-all for SPAs that avoids path-to-regexp issues
    app.use((req, res, next) => {
      // 1. Skip API calls
      if (req.path.startsWith("/api")) return next();
      
      // 2. Skip files with extensions (static assets)
      if (req.path.includes(".") && !req.path.endsWith(".html")) {
        return next();
      }
      
      // 3. Serve index.html for everything else (SPA)
      const indexPath = path.resolve(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      
      next();
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`[server] Server listening on port ${port}`);
    startScheduler();
  });
}

main().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
