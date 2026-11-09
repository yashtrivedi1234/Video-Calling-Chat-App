import { Link } from "react-router";

const FriendCard = ({ friend }) => {
  return (
    <div className="card bg-base-200 hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        {/* USER INFO */}
        <div className="flex items-center gap-3 mb-3">
          <div className="avatar size-12">
            <img src={friend.profilePic} alt={friend.fullName} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{friend.fullName}</h3>
            {friend.username && <p className="truncate text-sm text-base-content/60">@{friend.username}</p>}
          </div>
        </div>
        {friend.bio && <p className="mb-3 line-clamp-2 text-sm text-base-content/60">{friend.bio}</p>}

        <Link to={`/chat/${friend._id}`} className="btn btn-outline w-full">
          Message
        </Link>
      </div>
    </div>
  );
};
export default FriendCard;
