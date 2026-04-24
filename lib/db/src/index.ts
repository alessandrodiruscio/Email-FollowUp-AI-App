import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as campaigns from "./schema/campaigns.ts";
import * as reasons from "./schema/reasons.ts";
import * as reasonFollowUpTemplates from "./schema/reasonFollowUpTemplates.ts";
import * as recipients from "./schema/recipients.ts";
import * as followUpSteps from "./schema/followUpSteps.ts";
import * as sentEmails from "./schema/sentEmails.ts";
import * as emailEvents from "./schema/emailEvents.ts";

const schema = {
  ...campaigns,
  ...reasons,
  ...reasonFollowUpTemplates,
  ...recipients,
  ...followUpSteps,
  ...sentEmails,
  ...emailEvents,
};

let poolConnection: ReturnType<typeof mysql.createPool> | null = null;
let db: any = null;
let connectionError: Error | null = null;

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set. Database operations will fail. Please provision a database in the Secrets panel.",
  );
  connectionError = new Error("DATABASE_URL must be set.");
} else {
  try {
    // Parse DATABASE_URL explicitly for Hostinger MySQL compatibility
    // URL format: mysql://user:password@host:port/database
    const dbUrl = new URL(process.env.DATABASE_URL);
    
    // Log connection details for debugging
    console.log("[db] Connecting to:", dbUrl.hostname);
    
    const config = {
      host: dbUrl.hostname,
      port: parseInt(dbUrl.port || "3306", 10),
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.slice(1),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
    };
    
    // Always create the pool, but don't wait for connection verification
    // This allows the app to start even if the database is unreachable
    poolConnection = mysql.createPool(config);
    
    // Handle connection errors on the pool
    poolConnection.on('error', (err: Error) => {
      connectionError = err;
      console.error("[db] Connection pool error:", err.message);
    });
    
    db = drizzle(poolConnection, { schema, mode: "default" });
  } catch (err) {
    console.error("[db] Failed to initialize database:", err);
    connectionError = err instanceof Error ? err : new Error(String(err));
  }
}

export { db, connectionError };
export const pool = poolConnection;

export * from "./schema/campaigns.ts";
export * from "./schema/reasons.ts";
export * from "./schema/reasonFollowUpTemplates.ts";
export * from "./schema/recipients.ts";
export * from "./schema/followUpSteps.ts";
export * from "./schema/sentEmails.ts";
export * from "./schema/emailEvents.ts";
