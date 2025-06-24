import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signup } from "../lib/api.js";

const useSignUp = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: signup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authUser"] }),
    onError: (err) => {
      console.error("Signup failed:", err);
      // Optionally display toast or alert here
    },
  });

  return { isPending, error, signupMutation: mutate };
};
export default useSignUp;