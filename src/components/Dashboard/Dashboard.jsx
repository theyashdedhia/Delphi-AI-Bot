
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import Sidebar from "./Sidebar.jsx";
import "./Dashboard.css";
import ChatHistory from "./ChatHistory.jsx";
import Chat from "./Chat/Chat.jsx";

const Dashboard = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  //  Chat sessions stored in localStorage
  const [chatSessions, setChatSessions] = useState(() => {
    const saved = localStorage.getItem("chatSessions");
    return saved ? JSON.parse(saved) : {};
  });
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatKey, setChatKey] = useState(Date.now()); // re-mount trigger

  const navigate = useNavigate();
  const location = useLocation();
  const { instance, accounts } = useMsal();

  //  Persist chats in localStorage
  useEffect(() => {
    localStorage.setItem("chatSessions", JSON.stringify(chatSessions));
  }, [chatSessions]);

  //  Handle window resize
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

  // Logout handler
  const handleSignOut = () => {
    try {
      const account = instance.getActiveAccount() || accounts[0];
      instance.logoutRedirect({
        account,
        postLogoutRedirectUri: window.location.origin + "/login",
      });
    } catch (err) {
      console.error("Logout failed:", err);
      navigate("/login", { replace: true });
    }
  };

  //  Start new chat
  const handleNewChat = (chat) => {
    setChatSessions((prev) => ({
      ...prev,
      [chat.id]: { title: chat.title, messages: [] },
    }));
    setActiveChatId(chat.id);
    setChatKey(Date.now());
  };

  // Select chat
  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId);
    setChatKey(Date.now());
  };

  //  Delete chat
  const handleDeleteChat = (chatId) => {
    if (!window.confirm("Are you sure you want to delete this chat?")) return;

    setChatSessions((prev) => {
      const updated = { ...prev };
      delete updated[chatId];
      return updated;
    });

    if (chatId === activeChatId) {
      setActiveChatId(null);
      setChatKey(Date.now());
    }
  };

  //  Rename chat
  const handleRenameChat = (chatId, newTitle) => {
    if (!newTitle.trim()) return;
    setChatSessions((prev) => ({
      ...prev,
      [chatId]: {
        ...prev[chatId],
        title: newTitle.trim(),
      },
    }));
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        isMobile={isMobile}
        onToggle={toggleSidebar}
      />

      {/* Overlay for mobile */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main area */}
      <div
        className={`dashboard-content ${sidebarCollapsed ? "collapsed" : ""}`}
      >
        {/* Header */}
        <header className="dashboard-header">
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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

          <div className="header-content">
            <h1>Delphi AI Bot</h1>
          </div>

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
        </header>

        {/* Main section */}
        <main className="dashboard-main">
          <div className="main-content">
            {location.pathname.startsWith("/dashboard/chat") ? (
              <Chat
                key={chatKey}
                activeChatId={activeChatId}
                messages={chatSessions[activeChatId]?.messages || []}
                onMessagesChange={(updatedMessages) => {
                  setChatSessions((prev) => ({
                    ...prev,
                    [activeChatId]: {
                      ...(prev[activeChatId] || {}),
                      messages: updatedMessages,
                    },
                  }));
                }}
              />
            ) : (
              children
            )}
          </div>

          {/* Chat history panel */}
          {location.pathname.startsWith("/dashboard/chat") && (
            <ChatHistory
              chats={Object.entries(chatSessions).map(([id, data]) => ({
                id,
                title: data.title || "Untitled Chat",
                when: "Recently",
              }))}
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
