export default async (req: any, res: any) => {
  try {
    console.log("[vercel-api] Dynamically importing app...");
    const appModule = await import("../artifacts/api-server/src/app");
    const app = appModule.default;

    // If app is a function (Express app), just call it
    if (typeof app === 'function') {
      return (app as any)(req, res);
    }
    
    // Fallback if app is something else
    console.warn("[vercel-api] app is not a function:", typeof app);
    return res.status(500).json({ 
      error: "API Entry point misconfigured", 
      type: typeof app 
    });
  } catch (err: any) {
    console.error("[vercel-api] CRITICAL LOAD/RUNTIME ERROR:", err);
    return res.status(500).json({ 
      error: "Internal Server Error during load or execution", 
      message: err.message,
      stack: err.stack,
      hint: "Check if all dependencies are correctly installed and DATABASE_URL is valid."
    });
  }
};
