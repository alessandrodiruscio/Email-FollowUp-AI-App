import "./env.ts";
import express from "express";
import path from "path";
import app from "./app.ts";
import { startScheduler } from "./lib/scheduler.ts";

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + "..." : "NOT SET");

  // Vite integration for AI Studio
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vitePath = path.resolve(process.cwd(), "artifacts/email-followup");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: {
          usePolling: true,
          interval: 1000
        }
      },
      appType: "spa",
      root: vitePath
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "artifacts/email-followup/dist/public");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const rawPort = process.env["PORT"] || "3000";

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on port ${port}`);
    startScheduler();
  });
}

main().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
