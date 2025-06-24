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
    const isPublicRoute =
      window.location.pathname.startsWith("/login") ||
      window.location.pathname.startsWith("/signup") ||
      window.location.pathname.startsWith("/onboarding");

    if (isUnauthorized && !isPublicRoute) {
      toast.error("You're not logged in. Please log in again.");
    }

    return Promise.reject(error);
  }
);