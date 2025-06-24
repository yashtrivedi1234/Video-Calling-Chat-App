import { useQuery } from "@tanstack/react-query";
import { getAuthUser } from "../lib/api.js";
import { useEffect } from "react";
import toast from "react-hot-toast";

const useAuthUser = () => {
  const authUser = useQuery({
    queryKey: ["authUser"],
    queryFn: getAuthUser,
    retry: false, // auth check
  });

  useEffect(() => {
    if (authUser.data?.user === null && window.location.pathname !== "/login") {
      toast.error("You are not logged in");
    }
  }, [authUser.data]);

  return { isLoading: authUser.isLoading, authUser: authUser.data?.user };
};
export default useAuthUser;