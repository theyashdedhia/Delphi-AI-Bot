import React from 'react';
import './Chat.css';

const Chat = () => {
  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Chat</h2>
        <p>Start a conversation with Delphi AI</p>
      </div>
      
      <div className="chat-content">
        <div className="chat-placeholder">
          <div className="placeholder-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3>Welcome to Delphi Chat</h3>
          <p>This is where you'll be able to interact with the AI assistant.</p>
          <p>Chat functionality coming soon...</p>
        </div>
      </div>
    </div>
  );
};

export default Chat;
