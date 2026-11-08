import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded from the backend root directory (one level up from src/lib)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
process.env.MONGODB_URI ||= process.env.MONGO_URI;

console.log("Environment variables loaded from:", path.resolve(__dirname, "../../.env"));
