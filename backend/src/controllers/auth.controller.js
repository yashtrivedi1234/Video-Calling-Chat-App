import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { upsertStreamUser } from "../lib/stream.js";
import { sendPasswordResetEmail } from "../lib/email.js";
import { sendPush } from "../lib/push.js";
import PushSubscription from "../models/PushSubscription.js";
import { leavePresence } from "../lib/presence.js";
import { closeNotificationFeeds } from "../lib/notificationFeed.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};

export async function signup(req, res) {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email already exists, Please use a different one" });
    }

    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://api.dicebear.com/9.x/avataaars/svg?seed=${idx}.png`;
    const newUser = await User.create({
      fullName,
      email,
      password,
      profilePic: randomAvatar,
    });

    try {
      await upsertStreamUser({
        id: newUser._id.toString(),
        name: newUser.fullName,
        image: newUser.profilePic || "",
      });
      console.log(`Stream user created successfully for ${newUser.fullName}`);
    } catch (error) {
      console.log("Error creating Stream user:", error);
    }

    const token = jwt.sign(
      { userId: newUser._id, passwordVersion: newUser.passwordVersion || 0 },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "7d" }
    );
    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...cookieOptions,
    });
    newUser.password = undefined;
    res.status(201).json({ success: true, user: newUser });
    void sendPush([newUser._id], { title: "Welcome to Meetify", body: "Your account has been created.", url: "/onboarding", tag: `signup:${newUser._id}` });
  } catch (error) {
    console.log("Error in signup controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordCorrect = await user.matchPassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id, passwordVersion: user.passwordVersion || 0 }, process.env.JWT_SECRET_KEY, {
      expiresIn: "7d",
    });
    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...cookieOptions,
    });

    user.password = undefined;
    res.status(200).json({ success: true, user });
    void sendPush([user._id], { title: "New sign-in", body: "Your Meetify account was signed in.", url: "/", tag: "account-login" });
  } catch (error) {
    console.log("Error in login controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function logout(req, res) {
  try {
    res.clearCookie("jwt", cookieOptions);
    try {
      if (req.cookies?.jwt) {
        const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET_KEY);
        const user = await User.findById(decoded.userId);
        closeNotificationFeeds(decoded.userId, req.cookies.jwt);
        if (user && (decoded.passwordVersion || 0) === (user.passwordVersion || 0)) {
          await sendPush([user._id], { title: "Signed out", body: "Your Meetify session was signed out.", url: "/login", tag: "account-logout" });
          if (typeof req.body?.pushEndpoint === "string") await PushSubscription.deleteOne({ user: user._id, endpoint: req.body.pushEndpoint });
          if (typeof req.body?.deviceId === "string") await leavePresence(user._id, req.body.deviceId);
        }
      }
    } catch (error) {
      console.error("Logout notification cleanup failed:", error.name);
    }
    res.status(200).json({ success: true, message: "Logout successfully" });
  } catch (error) {
    console.log("Error in logout controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function forgotPassword(req, res) {
  const email = req.body?.email;
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  if (!["EMAIL_USER", "EMAIL_PASS", "CLIENT_URL"].every((key) => process.env[key])) {
    return res.status(503).json({ message: "Password reset email is not configured yet. Please try again later." });
  }

  try {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const resetUrl = new URL("/reset-password", process.env.CLIENT_URL);
    if (resetUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && resetUrl.protocol === "http:")) {
      throw new Error("CLIENT_URL must use HTTPS in production");
    }
    resetUrl.hash = token;

    const now = Date.now();
    const user = await User.findOneAndUpdate(
      {
        email: email.trim(),
        $or: [
          { passwordResetExpires: { $exists: false } },
          { passwordResetExpires: { $lte: new Date(now + 14 * 60 * 1000) } },
        ],
      },
      { $set: { passwordResetToken: tokenHash, passwordResetExpires: new Date(now + 15 * 60 * 1000) } },
      { new: true }
    ).select("email");

    res.status(200).json({ message: "If an account exists for this email, a password reset link will be sent. Check your inbox and spam folder." });
    if (!user) return;
    void sendPush([user._id], { title: "Password reset requested", body: "A password reset was requested for your Meetify account.", url: "/login", tag: "password-reset-request" });

    // Respond before delivery so email provider latency cannot reveal account existence.
    // shortcut: a restart can interrupt delivery; use a durable queue if guaranteed delivery is needed.
    try {
      await sendPasswordResetEmail(user.email, resetUrl.toString());
    } catch (error) {
      await User.updateOne(
        { _id: user._id, passwordResetToken: tokenHash },
        { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } }
      );
      console.error("Password reset email delivery failed:", error.code || error.name);
    }
  } catch (error) {
    console.error("Password reset request failed:", error.name);
    if (!res.headersSent) res.status(500).json({ message: "Unable to request a reset link. Please try again." });
  }
}

export async function resetPassword(req, res) {
  const { token, password } = req.body || {};
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ message: "This reset link is invalid or has expired. Request a new link." });
  }
  if (typeof password !== "string" || password.length < 6 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({ message: "Password must have at least 6 characters and at most 72 bytes." });
  }

  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { passwordResetToken: tokenHash, passwordResetExpires: { $gt: new Date() } },
      {
        $set: { password: hashedPassword },
        $unset: { passwordResetToken: 1, passwordResetExpires: 1 },
        $inc: { passwordVersion: 1 },
      },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(400).json({ message: "This reset link is invalid or has expired. Request a new link." });
    }

    res.clearCookie("jwt", cookieOptions);
    closeNotificationFeeds(user._id);
    void sendPush([user._id], { title: "Password changed", body: "Your Meetify password was changed. Previous sign-in sessions are no longer valid.", url: "/login", tag: "password-changed" });
    return res.status(200).json({ message: "Password updated. Sign in with your new password." });
  } catch (error) {
    console.error("Password reset failed:", error.name);
    return res.status(500).json({ message: "Unable to reset your password. Please try again." });
  }
}

export async function onboard(req, res) {
  try {
    const userId = req.user._id;
    const { fullName, bio, nativeLanguage, learningLanguage, location, profilePic } =
      req.body;
    const missingFields = [];
    if (!fullName) missingFields.push("fullName");
    if (!bio) missingFields.push("bio");
    if (!nativeLanguage) missingFields.push("nativeLanguage");
    if (!learningLanguage) missingFields.push("learningLanguage");
    if (!location) missingFields.push("location");

    if (missingFields.length > 0) {
      return res
        .status(400)
        .json({ message: "All fields are required", missingFields });
    }
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        fullName,
        bio,
        nativeLanguage,
        learningLanguage,
        location,
        profilePic,
        isOnboarded: true,
      },
      { new: true }
    );
    if (!updatedUser) {
      res.status(404).json({ message: "User not found" });
    }

    try {
      await upsertStreamUser({
        id: updatedUser._id.toString(),
        name: updatedUser.fullName,
        image: updatedUser.profilePic || "",
      });
      console.log(
        `Stream user updated successfully for ${updatedUser.fullName}`
      );
    } catch (streamError) {
      console.log("Error updating Stream user during onboarding:", streamError);
    }
    void sendPush([updatedUser._id], { title: "Profile updated", body: "Your Meetify profile has been updated.", url: "/", tag: "profile-updated" });
    return res.status(200).json({
      message: "User onboarded successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.log("Error in onboard controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
