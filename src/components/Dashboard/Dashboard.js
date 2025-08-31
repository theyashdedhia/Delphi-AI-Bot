import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import './Dashboard.css';

const Dashboard = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleSignOut = () => {
    // Placeholder sign-out logic
    console.log('Sign out clicked');
    // TODO: Add actual sign-out logic here
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={toggleSidebar}
      />
      <div className={`dashboard-content ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <header className="dashboard-header">
          <button 
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16,17 21,12 16,7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Sign Out</span>
          </button>
        </header>
        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
