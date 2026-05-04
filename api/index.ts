import app from "../artifacts/api-server/src/app";

export default async (req: any, res: any) => {
  if (req.url === "/api/vercel-debug" || req.url === "/vercel-debug") {
    const fs = require('fs');
    const path = require('path');
    let tree = {};
    try {
      const readDir = (dir: string, depth = 0): any => {
        if (depth > 3) return "...";
        try {
          const files = fs.readdirSync(dir);
          const result: any = {};
          for (const f of files) {
            if (f === "node_modules" || f === ".git") continue;
            const p = path.join(dir, f);
            if (fs.statSync(p).isDirectory()) {
              result[f] = readDir(p, depth + 1);
            } else {
              result[f] = fs.statSync(p).size;
            }
          }
          return result;
        } catch (e) {
          return "error reading";
        }
      };
      tree = readDir(process.cwd());
    } catch (e) {}

    return res.status(200).json({
      cwd: process.cwd(),
      dirname: __dirname,
      nodeEnv: process.env.NODE_ENV,
      tree
    });
  }

  try {
    // Ensuring we handle any potential sync errors during call
    return (app as any)(req, res);
  } catch (err: any) {
    console.error("[vercel-api] Runtime execution error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal Server Error",
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  }
};
