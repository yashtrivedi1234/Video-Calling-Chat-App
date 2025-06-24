import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getUserFriendsById } from "../lib/api.js";
import { toast } from "react-hot-toast";

const FriendsPage = () => {
  const { authUser } = useAuthUser();

  const { data: friends, isLoading } = useQuery({
    queryKey: ["userFriends", authUser?._id],
    queryFn: async () => {
      try {
        const data = await getUserFriendsById(authUser._id);
        
        return data;
      } catch (err) {
        toast.error("Failed to load friends");
        throw err;
      }
    },
    enabled: !!authUser?._id,
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Friends</h1>
      {friends?.length === 0 ? (
        <p>No friends found.</p>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {friends.map((friend) => (
            <div
              key={friend._id}
              className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="font-semibold text-lg">{friend.fullName}</div>
              <p className="text-sm text-gray-500">{friend.email}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FriendsPage;