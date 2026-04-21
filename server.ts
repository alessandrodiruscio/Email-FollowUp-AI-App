import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import app from "./artifacts/api-server/src/app.js";

async function startServer() {
  const PORT = process.env.PORT || 3000;

  // Let Vite handle the frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: path.join(process.cwd(), "artifacts/email-followup"),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "artifacts/email-followup/dist/public");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
