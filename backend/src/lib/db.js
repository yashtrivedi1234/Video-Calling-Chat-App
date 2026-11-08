// At the top of the file
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      console.error("\n[CRITICAL] MongoDB Connection Failed: Could not resolve the database hostname.");
      console.error("Check if your MONGODB_URI is correct and that your network/VPN allows access to the MongoDB cluster.\n");
    } else {
      console.error("MongoDB connection failed:", error);
    }
    process.exit(1);
  }
};

export default connectDB;
