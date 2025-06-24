import { logout } from "../lib/api.js";

export const useLogout = () => {
  const logoutMutation = async () => {
    try {
      await logout();                        // backend logout
      localStorage.removeItem("token");      // clear token
    } catch (error) {
      console.log("Logout failed:", error);
      throw error; // rethrow so caller can handle error
    }
  };

  return { logoutMutation };
};