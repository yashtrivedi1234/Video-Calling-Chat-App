import { logout } from "../lib/api.js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearBrowserPush } from "../lib/push.js";

export const useLogout = () => {
  const queryClient = useQueryClient();
  const { mutateAsync: logoutMutation, isPending } = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await clearBrowserPush().catch(() => {});
      await queryClient.cancelQueries();
      queryClient.setQueryData(["authUser"], { user: null });
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "authUser" });
      localStorage.removeItem("token");
    },
  });

  return { logoutMutation, isPending };
};
