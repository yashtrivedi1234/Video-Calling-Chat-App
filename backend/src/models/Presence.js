import mongoose from "mongoose";

const presenceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  deviceId: { type: String, required: true },
  lastSeenAt: { type: Date, required: true, index: true },
});
presenceSchema.index({ user: 1, deviceId: 1 }, { unique: true });

export default mongoose.model("Presence", presenceSchema);
