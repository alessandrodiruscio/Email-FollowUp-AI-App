import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

async function main() {
  // Clear old environment variables before loading new ones
  delete process.env.DATABASE_URL;

  // Load .env from workspace root
  // Handle both ESM (development) and CJS (production bundle) environments
  let __dirname: string;
  try {
    // ESM environment: import.meta.url is available
    if (import.meta.url) {
      const __filename = fileURLToPath(import.meta.url);
      __dirname = path.dirname(__filename);
    } else {
      throw new Error("import.meta.url not available");
    }
  } catch {
    // CJS environment: import.meta.url is undefined
    // When bundled, __dirname might be available or we use process.cwd()
    __dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  }

  // Try to load .env from workspace root, then from current directory
  const potentialPaths = [
    path.resolve(__dirname, "../../..", ".env"),  // Dev: artifacts/api-server/src relative
    path.resolve(__dirname, "../.env"),             // Bundled: dist/index.cjs relative
    path.resolve(process.cwd(), ".env"),            // Current working directory
    "/.env",                                        // Root
  ];

  let envPath: string | null = null;
  const fs = await import("fs/promises");
  
  for (const checkPath of potentialPaths) {
    try {
      await fs.access(checkPath);
      envPath = checkPath;
      console.log("Loading .env from:", envPath);
      break;
    } catch {
      // File doesn't exist, try next path
    }
  }

  if (envPath) {
    const result = dotenv.config({ path: envPath, override: true });
    if (result.error && result.error.code !== 'ENOENT') {
      console.error("Error loading .env:", result.error);
    } else if (!result.error) {
      console.log("Successfully loaded .env file with", Object.keys(result.parsed || {}).length, "variables");
    }
  } else {
    console.warn(".env file not found at any expected location, using system environment variables");
  }

  // Now dynamically import modules that depend on DATABASE_URL
  const { default: app } = await import("./app.js");
  const { startScheduler } = await import("./lib/scheduler.js");

  console.log("DATABASE_URL:", process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + "..." : "NOT SET");

  // Vite integration for AI Studio
  const express = (await import("express")).default;
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vitePath = path.resolve(process.cwd(), "artifacts/email-followup");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa",
      root: vitePath
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "artifacts/email-followup/dist/public");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
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
