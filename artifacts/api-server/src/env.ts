import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const rootDir = process.cwd();

const potentialPaths = [
  path.resolve(rootDir, ".env"),           
  path.resolve(rootDir, "artifacts/api-server/.env"),
  "/.env",                                       
];

let envPath: string | null = null;

for (const checkPath of potentialPaths) {
  if (fs.existsSync(checkPath)) {
    envPath = checkPath;
    console.log("Loading .env from:", envPath);
    break;
  }
}

if (envPath) {
  dotenv.config({ path: envPath, override: true });
} else {
  console.warn(".env file not found, using environment variables");
}
