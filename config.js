// config.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env once
dotenv.config({ path: path.join(__dirname, "config.env") });

export default process.env;
