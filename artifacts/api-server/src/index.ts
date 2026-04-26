import "./env";
import express from "express";
import path from "path";
import app from "./app";
import { startScheduler } from "./lib/scheduler";

async function main() {
  console.log("[server] Starting server initialization...");
  
  // Vite integration for AI Studio
  const vitePath = path.resolve(process.cwd(), "artifacts/email-followup");
  console.log(`[server] Vite root path: ${vitePath}`);

  const port = 3000;
  console.log(`[server] Attempting to listen on port ${port}...`);

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
    const distPath = path.resolve(vitePath, "dist/public");
    console.log(`[server] Serving static from ${distPath}`);
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
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
