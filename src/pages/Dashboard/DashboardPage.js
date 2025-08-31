import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from '../../components/Dashboard/Dashboard';
import Chat from '../../components/Dashboard/Chat/Chat';
import Documents from '../../components/Dashboard/Documents/Documents';

const DashboardPage = () => {
  return (
    <Dashboard>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard/chat" replace />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/documents" element={<Documents />} />
      </Routes>
    </Dashboard>
  );
};

export default DashboardPage;
