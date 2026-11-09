import { Link, useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useAuthUser from "../hooks/useAuthUser.js";
import { BellIcon, LogOutIcon, SearchIcon, ShipWheelIcon } from "lucide-react";
import ThemeSelector from "./ThemeSelector.jsx";
import { useLogout } from "../hooks/useLogout.js";
import PushNotificationButton from "./PushNotificationButton.jsx";

const Navbar = () => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const isChatPage = location.pathname?.startsWith("/chat");
  const navigate = useNavigate();

  const { logoutMutation, isPending } = useLogout();

  return (
    <nav className="bg-base-200 border-b border-base-300 sticky top-0 z-30 h-16 shrink-0 flex items-center">
      <div className="container mx-auto min-w-0 px-2 sm:px-6 lg:px-8">
        <div className="flex w-full min-w-0 items-center justify-end gap-1 sm:gap-2">
            <div className={`mr-auto shrink-0 ${isChatPage ? "" : "lg:hidden"}`}>
              <Link to="/" aria-label="Meetify home" className="flex min-h-11 min-w-11 items-center justify-center gap-2.5">
                <ShipWheelIcon className="size-7 text-primary sm:size-9" />
                <span className="hidden text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider sm:inline">
                  Meetify
                </span>
              </Link>
            </div>

          <Link to="/search" aria-label="Search people" className="btn btn-ghost btn-circle shrink-0">
            <SearchIcon className="size-6 text-base-content/70" />
          </Link>

          <Link to="/notifications" aria-label="Notifications" className="btn btn-ghost btn-circle shrink-0">
            <BellIcon className="h-6 w-6 text-base-content opacity-70" />
          </Link>

          <PushNotificationButton userId={authUser?._id} />
          <ThemeSelector />

          <div className="avatar hidden shrink-0 sm:block" title={`@${authUser?.username}`}>
            <div className="w-8 rounded-full sm:w-9">
              <img src={authUser?.profilePic} alt="User Avatar" rel="noreferrer" />
            </div>
          </div>

          {/* Logout button */}
           <button
            className="btn btn-ghost btn-circle shrink-0"
            aria-label="Log out"
            disabled={isPending}
            onClick={async () => {
              try {
                await logoutMutation();
                toast.dismiss();
                navigate("/login", { replace: true });
              } catch {
                toast.error("Logout failed. Please try again.");
              }
            }}
          >
            <LogOutIcon className="h-6 w-6 text-base-content opacity-70" />
          </button>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
