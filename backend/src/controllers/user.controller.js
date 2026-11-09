import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import { sendPush } from "../lib/push.js";
import { normalizeUsername, USERNAME_PATTERN, USERNAME_HELP } from "../lib/username.js";

export async function checkUsername(req, res) {
  const username = normalizeUsername(req.query.username);
  if (!USERNAME_PATTERN.test(username)) return res.status(400).json({ message: USERNAME_HELP });
  try {
    const taken = await User.exists({ username, _id: { $ne: req.user._id } });
    return res.json({ username, available: !taken });
  } catch (error) {
    console.error("Username check failed:", error.message);
    return res.status(500).json({ message: "Couldn't check this username. Try again." });
  }
}

export async function searchUsers(req, res) {
  if (typeof req.query.q !== "string" || req.query.q.trim().length > 80) {
    return res.status(400).json({ message: "Search by name or username, up to 80 characters." });
  }
  const term = req.query.q.trim().replace(/^@/, "");
  if (!term) return res.json({ users: [] });
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    // shortcut: bounded regex search suits this small directory; use a search index as it grows.
    const people = await User.find({
      _id: { $ne: req.user._id }, isOnboarded: true,
      $or: [{ username: { $regex: escaped, $options: "i" } }, { fullName: { $regex: escaped, $options: "i" } }],
    }).select("fullName username profilePic bio").sort({ username: 1, _id: 1 }).limit(20).lean();
    const ids = people.map((person) => person._id);
    const requests = ids.length ? await FriendRequest.find({
      status: "pending",
      $or: [{ sender: req.user._id, recipient: { $in: ids } }, { recipient: req.user._id, sender: { $in: ids } }],
    }).select("sender recipient").lean() : [];
    const friends = new Set((req.user.friends || []).map(String));
    const users = people.map((person) => {
      const id = String(person._id);
      const request = requests.find((item) => String(item.sender) === id || String(item.recipient) === id);
      const relationship = friends.has(id) ? "friend" : request ? (String(request.sender) === id ? "incoming" : "outgoing") : "none";
      return { ...person, relationship, ...(relationship === "incoming" ? { requestId: request._id } : {}) };
    });
    return res.json({ users });
  } catch (error) {
    console.error("People search failed:", error.message);
    return res.status(500).json({ message: "Couldn't search right now. Try again." });
  }
}

export async function getRecommendedUsers(req, res) {
  try {
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId).select("friends");
    
    const recommendedUsers = await User.find({
      $and: [
        { _id: { $ne: currentUserId } },
        { _id: { $nin: currentUser.friends || [] } },
        { isOnboarded: true },
      ],
    }).select("fullName username profilePic bio location");

    res.status(200).json({ recommendedUsers });
  } catch (error) {
    console.error("Error in getRecommendedUsers Controller", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getMyFriends(req, res) {
  try {
    const user = await User.findById(req.user._id)
      .select("friends")
      .populate(
        "friends",
        "fullName username profilePic bio"
      );
    res.status(200).json({ friends: user.friends });
  } catch (error) {
    console.log("Error in getMyFriends Controller", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function sendFriendRequest(req, res) {
  try {
    const myId = req.user._id;
    const { id: recipientId } = req.params;

    if (myId.toString() === recipientId) {
      return res
        .status(400)
        .json({ message: "You cannot send a friend request to yourself." });
    }

    const recipient = await User.findById(recipientId);

    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found." });
    }

    if (recipient.friends.includes(myId)) {
      return res.status(400).json({ message: "You are already friends." });
    }

    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: myId, recipient: recipientId },
        { sender: recipientId, recipient: myId },
      ],
    });

    if (existingRequest) {
      return res.status(400).json({ message: "Friend request already sent." });
    }

    const newFriendRequest = new FriendRequest({
      sender: myId,
      recipient: recipientId,
    });
    await newFriendRequest.save();
    void sendPush([recipientId], { id: `friend-request:${newFriendRequest._id}`, title: "New friend request", body: `${req.user.fullName} sent you a friend request.`, url: "/notifications", tag: `friend-request:${newFriendRequest._id}` });
    void sendPush([myId], { title: "Friend request sent", body: `Your friend request to ${recipient.fullName} was sent.`, url: "/notifications", tag: `friend-request-sent:${newFriendRequest._id}` });
    res.status(200).json({ message: "Friend request sent successfully." });
  } catch (error) {
    console.error("Error in sendFriendRequest Controller", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function acceptFriendRequest(req, res) {
  try {
    const { id: requestId } = req.params;
    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found." });
    }

    if (friendRequest.recipient.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You are not authorized to accept this request." });
    }
    friendRequest.status = "accepted";
    await friendRequest.save();

    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: friendRequest.recipient },
    });
    await User.findByIdAndUpdate(friendRequest.recipient, {
      $addToSet: { friends: friendRequest.sender },
    });
    void sendPush([friendRequest.sender], { id: `friend-accepted:${friendRequest._id}`, title: "Friend request accepted", body: `${req.user.fullName} accepted your friend request.`, url: `/chat/${req.user._id}`, tag: `friend-accepted:${friendRequest._id}` });
    void sendPush([friendRequest.recipient], { id: `friend-connected:${friendRequest._id}`, title: "New connection", body: "You’re now connected and can start a conversation.", url: `/chat/${friendRequest.sender}`, tag: `friend-connected:${friendRequest._id}` });
    res.status(200).json({ message: "Friend request accepted successfully." });
  } catch (error) {
    console.log("Error in acceptFriendRequest Controller", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getFriendRequests(req, res) {
  try {
    const incomingReqs = await FriendRequest.find({
      recipient: req.user._id,
      status: "pending",
    }).populate(
      "sender",
      "fullName username profilePic"
    );

    const acceptedReqs = await FriendRequest.find({
      sender: req.user._id,
      status: "accepted",
    }).populate("recipient", "fullName username profilePic");
    res.status(200).json({ incomingReqs, acceptedReqs });
  } catch (error) {
    console.log("Error in getFriendRequests Controller", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getOutgoingFriendReqs(req, res) {
  try {
    const outgoingReqs = await FriendRequest.find({
      sender: req.user._id,
      status: "pending",
    }).populate(
      "recipient",
      "fullName username profilePic"
    );
    res.status(200).json({ outgoingReqs });
  } catch (error) {
    console.log("Error in getOutgoingFriendReqs Controller", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}


export const getUserFriendsById = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).populate("friends", "fullName username profilePic bio");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ friends: user.friends });
  } catch (error) {
    console.error("Error fetching user's friends:", error);
    res.status(500).json({ message: "Server error" });
  }
};
