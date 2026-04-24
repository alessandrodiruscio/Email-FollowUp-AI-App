import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as campaigns from "./schema/campaigns";
import * as reasons from "./schema/reasons";
import * as reasonFollowUpTemplates from "./schema/reasonFollowUpTemplates";
import * as recipients from "./schema/recipients";
import * as followUpSteps from "./schema/followUpSteps";
import * as sentEmails from "./schema/sentEmails";
import * as emailEvents from "./schema/emailEvents";

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
    (poolConnection as any).on('error', (err: Error) => {
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

export * from "./schema/campaigns";
export * from "./schema/reasons";
export * from "./schema/reasonFollowUpTemplates";
export * from "./schema/recipients";
export * from "./schema/followUpSteps";
export * from "./schema/sentEmails";
export * from "./schema/emailEvents";
