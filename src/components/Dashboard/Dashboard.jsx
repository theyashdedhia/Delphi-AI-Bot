
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDarkMode } from "../../contexts/DarkModeContext.jsx";
import { useMsal } from "@azure/msal-react";
import Sidebar from "./Sidebar.jsx";
import ChatHistory from "./ChatHistory.jsx";
import "./Dashboard.css";

const Dashboard = ({ children }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { instance, accounts } = useMsal();

  // Handle window resizing for mobile responsiveness
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sidebar toggle
  const toggleSidebar = () => {
    if (isMobile) setMobileSidebarOpen((o) => !o);
    else setSidebarCollapsed((c) => !c);
  };

  // Sign out logic
  const handleSignOut = () => {
    try {
      const account = instance.getActiveAccount() || accounts[0];
      console.log("🧭 Logging out account:", account);

      instance.logoutRedirect({
        account,
        postLogoutRedirectUri: window.location.origin + "/login",
      });
    } catch (err) {
      console.error("Logout failed:", err);
      navigate("/login", { replace: true });
    }
  };

  // Example chat history list — can be replaced with backend data later
  const [chatList, setChatList] = useState([
    { id: "c1", title: "Iron eligibility trends", when: "2h ago" },
    { id: "c2", title: "Plasma donation data", when: "Yesterday" },
  ]);

  // Handlers for ChatHistory actions
  const handleSelectChat = (id) => console.log("Selected chat:", id);
  const handleNewChat = (newChat) =>
    setChatList((prev) => [...prev, newChat]);
  const handleDeleteChat = (id) =>
    setChatList((prev) => prev.filter((chat) => chat.id !== id));
  const handleRenameChat = (id, newTitle) =>
    setChatList((prev) =>
      prev.map((chat) => (chat.id === id ? { ...chat, title: newTitle } : chat))
    );

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        isMobile={isMobile}
        onToggle={toggleSidebar}
      />

      {/* Overlay for mobile sidebar */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main dashboard layout */}
      <div
        className={`dashboard-content ${sidebarCollapsed ? "collapsed" : ""}`}
      >
        {/* Header */}
        <header className="dashboard-header">
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <div className="header-actions">
            {/* Dark Mode toggle */}
            <button
              className="dark-mode-toggle"
              onClick={toggleDarkMode}
              aria-label={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              title={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                {isDarkMode ? (
                  <>
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </>
                ) : (
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                )}
              </svg>
            </button>

            {/* Sign-out button */}
            <button
              className="sign-out-button"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16,17 21,12 16,7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Main content area */}
        <main className="dashboard-main">
          <div className="main-content">{children}</div>

          {/* Only show ChatHistory on chat route */}
          {location.pathname.startsWith("/dashboard/chat") && (
            <ChatHistory
              chats={chatList}
              onSelectChat={handleSelectChat}
              onNewChat={handleNewChat}
              onDeleteChat={handleDeleteChat}
              onRenameChat={handleRenameChat}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
