import "./lib/env.js";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import connectDB from "./lib/db.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import notificationRoutes from "./routes/notification.route.js";
import { streamWebhook } from "./controllers/notification.controller.js";
import { expirePresence } from "./lib/presence.js";
import { streamClient } from "./lib/stream.js";

const __dirname = path.resolve();

const requiredEnvVars = [
  "MONGODB_URI",
  "STREAM_API_KEY",
  "STREAM_API_SECRET",
  "JWT_SECRET_KEY",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.log("CWD:", process.cwd());
  console.log("Looking for .env at:", path.resolve(__dirname, ".env"));
  console.error(
    `FATAL: Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  console.error("Please update your backend/.env file and restart the server.");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: [process.env.CLIENT_URL, ...(process.env.CORS_ORIGINS || "").split(",")].map((o) => o?.trim()).filter(Boolean),
  credentials: true
}));

app.post("/api/notifications/stream-webhook", express.raw({ type: "application/json", limit: "256kb" }), streamWebhook);
app.use(express.json());
app.use(cookieParser());

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);

// ✅ Health Check API
const withTimeout = (promise, ms = 3000) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

const checkService = async (fn) => {
  const start = Date.now();
  try {
    await withTimeout(fn());
    return { status: "up", latencyMs: Date.now() - start };
  } catch (error) {
    return { status: "down", latencyMs: Date.now() - start, error: error.message };
  }
};

app.get("/api/health", async (req, res) => {
  const [database, stream] = await Promise.all([
    checkService(() => mongoose.connection.db.admin().ping()),
    checkService(() => streamClient.queryUsers({}, {}, { limit: 1 })),
  ]);

  const mem = process.memoryUsage();
  const healthy = database.status === "up" && stream.status === "up";

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? "healthy" : "unhealthy",
    environment: process.env.NODE_ENV || "development",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    services: { database, stream },
    config: {
      email: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      clientUrl: Boolean(process.env.CLIENT_URL),
    },
    memoryMB: { rss: Math.round(mem.rss / 1048576), heapUsed: Math.round(mem.heapUsed / 1048576) },
    node: process.version,
  });
});

// ✅ Production setup
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// ✅ Start Server after DB connect
connectDB().then(() => {
  // A missed browser-close event becomes an offline status after its 90-second lease expires.
  setInterval(() => expirePresence().catch((error) => console.error("Presence cleanup failed:", error.name)), 30000).unref();
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
});
