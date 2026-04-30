import app from "../artifacts/api-server/src/app";

export default async (req: any, res: any) => {
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
