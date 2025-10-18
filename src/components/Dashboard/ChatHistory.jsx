
import React, { useState, useMemo } from "react";
import "./ChatHistory.css";

const ChatHistory = ({
  chats = [],
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
}) => {
  const [editingChatId, setEditingChatId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Filter chats by title
  const filteredChats = useMemo(() => {
    if (!searchTerm.trim()) return chats;
    return chats.filter((chat) =>
      chat.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, chats]);

  return (
    <aside className="chat-history">
      {/* Header + Search bar */}
      <div className="chat-history-header">
        <h3>Chat History</h3>
        <button
          className="new-chat-button"
          onClick={() => {
            const newChat = {
              id: `chat_${Date.now()}`,
              title: `New Chat ${chats.length + 1}`,
              when: "Just now",
            };
            onNewChat(newChat);
          }}
        >
          + New Chat
        </button>
      </div>

      {/* Search field */}
      <div className="chat-search-container">
        <input
          type="text"
          placeholder="Search chats..."
          className="chat-search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Empty state */}
      {filteredChats.length === 0 ? (
        <div className="empty-history">
          <p>No chats found.</p>
        </div>
      ) : (
        <ul className="chat-list">
          {filteredChats.map((chat) => (
            <li
              key={chat.id}
              className="chat-item"
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="chat-item-content">
                <div className="chat-info">
                  {editingChatId === chat.id ? (
                    <input
                      className="rename-input"
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onBlur={() => {
                        onRenameChat(chat.id, newTitle);
                        setEditingChatId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onRenameChat(chat.id, newTitle);
                          setEditingChatId(null);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="chat-title"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingChatId(chat.id);
                        setNewTitle(chat.title);
                      }}
                      title="Double-click to rename"
                    >
                      {chat.title}
                    </span>
                  )}
                  <span className="chat-time">{chat.when}</span>
                </div>

                <button
                  className="delete-chat-button"
                  title="Delete chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
};

export default ChatHistory;

