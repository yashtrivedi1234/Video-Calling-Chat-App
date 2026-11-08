import Sidebar from "./Sidebar.jsx";
import Navbar from "./Navbar.jsx";
import { useLocation } from "react-router-dom";

const Layout = ({ children, showSidebar = false }) => {
  const isChatPage = useLocation().pathname.startsWith("/chat/");

  return (
    <div className={isChatPage ? "h-dvh overflow-hidden" : "min-h-screen"}>
      <div className={`flex min-w-0 ${isChatPage ? "h-full" : ""}`}>
        {showSidebar && <Sidebar />}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Navbar />

          <main className={`min-w-0 flex-1 ${isChatPage ? "min-h-0 overflow-hidden" : "overflow-y-auto"}`}>{children}</main>
        </div>
      </div>
    </div>
  );
};
export default Layout;
