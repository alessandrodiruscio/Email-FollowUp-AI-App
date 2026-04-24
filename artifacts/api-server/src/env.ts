import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

let __dirname: string;
try {
  if (import.meta.url) {
    const __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
  } else {
    __dirname = process.cwd();
  }
} catch {
  __dirname = process.cwd();
}

const potentialPaths = [
  path.resolve(__dirname, "../../..", ".env"), 
  path.resolve(__dirname, "../.env"),            
  path.resolve(process.cwd(), ".env"),           
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
