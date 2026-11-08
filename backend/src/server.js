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
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
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
app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;

  const status = {
    0: "Disconnected",
    1: "Connected",
    2: "Connecting",
    3: "Disconnecting",
  };

  res.status(200).json({
    success: true,
    message: "Health check OK ✅",
    server: "Running",
    database: status[dbState],
    uptime: process.uptime(),
    timestamp: new Date(),
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
