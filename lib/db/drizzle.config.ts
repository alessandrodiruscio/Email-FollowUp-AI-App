const { defineConfig } = require("drizzle-kit");
const path = require("path");
const dotenv = require("dotenv");

// Load .env from workspace root
const workspaceRoot = path.resolve(__dirname, "../../");
const envPath = path.join(workspaceRoot, ".env");
dotenv.config({ path: envPath, override: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
