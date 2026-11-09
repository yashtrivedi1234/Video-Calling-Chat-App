import express from "express";
import { protectRoute } from "../middlewares/auth.middlewares.js";
import {
  getRecommendedUsers,
  getMyFriends,
  sendFriendRequest,
  acceptFriendRequest,
  getFriendRequests,
  getOutgoingFriendReqs,
  getUserFriendsById,
  searchUsers,
  checkUsername,
} from "../controllers/user.controller.js";
const router = express.Router();

router.use(protectRoute);

router.get("/", getRecommendedUsers);
router.get("/friends", getMyFriends);
router.get("/search", searchUsers);
router.get("/username", checkUsername);
router.post("/friend-request/:id", sendFriendRequest);
router.put("/friend-request/:id/accept", acceptFriendRequest);
router.get("/friend-requests", getFriendRequests);
router.get("/outgoing-friend-requests", getOutgoingFriendReqs);
router.get("/:id/friends", getUserFriendsById);

export default router;
