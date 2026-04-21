import { Router, type IRouter } from "express";
import { db } from "@workspace/db";

const router: IRouter = Router();

// Debug endpoint to test Resend credential fetching
router.get("/debug/resend-credentials", async (req, res) => {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  console.log("[debug] Attempting to fetch Resend credentials...");
  console.log("[debug] Hostname:", hostname);
  console.log("[debug] Token available:", !!xReplitToken);
  console.log("[debug] Token type:", xReplitToken?.split(" ")[0]);

  if (!hostname || !xReplitToken) {
    return res.json({
      success: false,
      reason: "Missing environment variables",
      hostname: hostname || "NOT SET",
      tokenAvailable: !!xReplitToken,
      repl_identity: !!process.env.REPL_IDENTITY,
      web_repl_renewal: !!process.env.WEB_REPL_RENEWAL,
    });
  }

  try {
    const url = "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend";
    console.log("[debug] Fetching from:", url);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    });

    console.log("[debug] Response status:", response.status);

    if (!response.ok) {
      console.warn("[debug] Connector API returned status:", response.status);
      const text = await response.text();
      return res.json({
        success: false,
        reason: "Connector API error",
        status: response.status,
        responseText: text.substring(0, 200),
      });
    }

    const json = await response.json();
    const item = json?.items?.[0];

    if (!item) {
      return res.json({
        success: false,
        reason: "No connector items found",
        items: json?.items?.length || 0,
      });
    }

    if (!item.settings?.api_key) {
      return res.json({
        success: false,
        reason: "No API key in settings",
        hasSettings: !!item.settings,
        hasApiKey: !!item.settings?.api_key,
      });
    }

    return res.json({
      success: true,
      apiKey: item.settings.api_key.substring(0, 10) + "...",
      fromEmail: item.settings.from_email,
    });
  } catch (err) {
    console.error("[debug] Error fetching credentials:", err);
    return res.json({
      success: false,
      reason: "Exception during fetch",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.post("/init/setup-email-tracking", async (req, res) => {
  try {
    console.log("[init] Setting up email tracking tables...");

    // 1. Add messageId column to sent_emails if it doesn't exist
    try {
      await db.execute("ALTER TABLE sent_emails ADD COLUMN message_id VARCHAR(255)");
      console.log("[init] ✓ messageId column added to sent_emails");
    } catch (e: any) {
      if (e.code === "ER_DUP_FIELDNAME" || e.message?.includes("Duplicate column")) {
        console.log("[init] ✓ messageId column already exists");
      } else if (e.code !== "ER_DUP_FIELDNAME") {
        // Only throw if it's not a duplicate column error
        throw e;
      }
    }

    // 2. Create email_events table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS email_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sent_email_id INT NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        event_type ENUM('sent', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed') NOT NULL,
        timestamp DATETIME NOT NULL,
        metadata LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sent_email_id) REFERENCES sent_emails(id) ON DELETE CASCADE,
        INDEX idx_message_id (message_id),
        INDEX idx_event_type (event_type),
        INDEX idx_timestamp (timestamp)
      )
    `);
    console.log("[init] ✓ email_events table created");

    // 3. Create index on sent_emails.message_id
    try {
      await db.execute("CREATE INDEX idx_sent_emails_message_id ON sent_emails(message_id)");
      console.log("[init] ✓ Index created on sent_emails.message_id");
    } catch (e: any) {
      if (e.code === "ER_DUP_KEYNAME" || e.message?.includes("already exists")) {
        console.log("[init] ✓ Index already exists");
      } else {
        // For non-critical index creation, just log a warning
        console.warn("[init] Index creation warning:", e.message);
      }
    }

    console.log("[init] ✅ Email tracking setup complete!");
    res.json({
      success: true,
      message: "Email tracking database setup complete",
    });
  } catch (error: any) {
    console.error("[init] ❌ Error setting up email tracking:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to set up email tracking",
      detail: error.message,
    });
  }
});

export default router;
