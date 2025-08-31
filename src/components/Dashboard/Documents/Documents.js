import React from 'react';
import './Documents.css';

const Documents = () => {
  return (
    <div className="documents-container">
      <div className="documents-header">
        <h2>Documents</h2>
        <p>Manage and analyze your documents with Delphi AI</p>
      </div>
      
      <div className="documents-content">
        <div className="documents-placeholder">
          <div className="placeholder-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
          </div>
          <h3>Document Management</h3>
          <p>Upload, organize, and analyze your documents with AI-powered insights.</p>
          <p>Document functionality coming soon...</p>
        </div>
      </div>
    </div>
  );
};

export default Documents;
