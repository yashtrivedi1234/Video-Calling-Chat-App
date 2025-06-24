import { axiosInstance } from "./axios.js";

export const signup = async (signupData) => {
  try {
    const response = await axiosInstance.post("/auth/signup", signupData);
    return response.data;
  } catch (error) {
    console.log("Error in signup:", error);
    throw error;
  }
};

export const login = async (loginData) => {
  try {
    const response = await axiosInstance.post("/auth/login", loginData);
    return response.data;
  } catch (error) {
    console.log("Error in login:", error);
    throw error;
  }
};
export const logout = async () => {
  try {
    const response = await axiosInstance.post("/auth/logout");
    return response.data;
  } catch (error) {
    console.log("Error in logout:", error);
    throw error;
  }
};

export const getAuthUser = async () => {
  try {
    const res = await axiosInstance.get("/auth/me");
    return res.data;
  } catch (error) {
    console.log("Error in getAuthUser:", error);
    throw error;
  }
};

export const completeOnboarding = async (userData) => {
  try {
    const response = await axiosInstance.post("/auth/onboarding", userData);
    return response.data;
  } catch (error) {
    console.log("Error in completeOnboarding:", error);
    throw error;
  }
};

export async function getUserFriends() {
  try {
    const response = await axiosInstance.get("/users/friends");
    return response.data.friends;
  } catch (error) {
    console.log("Error in getUserFriends:", error);
    throw error;
  }
}

export async function getRecommendedUsers() {
  try {
    const response = await axiosInstance.get("/users");
    return response.data.recommendedUsers;
  } catch (error) {
    console.log("Error in getRecommendedUsers:", error);
    throw error;
  }
}

export async function getOutgoingFriendReqs() {
  try {
    const response = await axiosInstance.get("/users/outgoing-friend-requests");
    return response.data;
  } catch (error) {
    console.log("Error in getOutgoingFriendReqs:", error);
    throw error;
  }
}

export const sendFriendRequest = async (toUserId) => {
  try {
    const res = await axiosInstance.post(`/users/friend-request/${toUserId}`);
    return res.data;
  } catch (err) {
    console.error("Send Friend Request Error:", err.response?.data || err.message);
    throw err;
  }
};

export async function getFriendRequests() {
  try {
    const response = await axiosInstance.get("/users/friend-requests");
    return response.data;
  } catch (error) {
    console.log("Error in getFriendRequests:", error);
    throw error;
  }
}

export async function acceptFriendRequest(requestId) {
  try {
    const response = await axiosInstance.put(`/users/friend-request/${requestId}/accept`);
    return response.data;
  } catch (error) {
    console.log("Error in acceptFriendRequest:", error);
    throw error;
  }
}

export async function getStreamToken() {
  try {
    const response = await axiosInstance.get("/chat/token");
    return response.data;
  } catch (error) {
    console.log("Error in getStreamToken:", error);
    throw error;
  }
}

export async function getUserFriendsById(userId) {
  try {
    const response = await axiosInstance.get(`/users/${userId}/friends`);
    return response.data.friends;
  } catch (error) {
    console.log("Error in getUserFriendsById:", error);
    throw error;
  }
}