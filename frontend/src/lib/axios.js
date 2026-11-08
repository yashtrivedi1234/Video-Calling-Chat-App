import axios from "axios";
import toast from "react-hot-toast";
const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "/api";

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send cookies with the request
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const isUnauthorized = error.response?.status === 401;
    const isBackgroundCheck = ["/auth/me", "/notifications/presence"].includes(error.config?.url);
    const isPublicRoute = ["/login", "/signup", "/forgot-password", "/reset-password"].includes(window.location.pathname);

    if (isUnauthorized && !isBackgroundCheck && !isPublicRoute) {
      toast.error("Your session has expired. Please sign in again.", { id: "session-expired" });
    }

    return Promise.reject(error);
  }
);
