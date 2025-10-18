
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./pages/Dashboard/DashboardPage.jsx";
import Login from "./pages/auth/Login.jsx";
import { DarkModeProvider } from "./contexts/DarkModeContext.jsx";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "./authConfig";

/* ------------------------------------------------------
   Ensure user session is restored and active
------------------------------------------------------ */
function EnsureActiveAccount() {
  const { instance, accounts } = useMsal();

  useEffect(() => {
    const active = instance.getActiveAccount();
    if (!active && accounts.length > 0) {
      console.log("🪄 Restoring MSAL account:", accounts[0]);
      instance.setActiveAccount(accounts[0]);
    }

    if (!active && accounts.length === 0) {
      console.log("No MSAL account, redirecting to login");
      instance.loginRedirect(loginRequest);
    }
  }, [accounts, instance]);

  return null;
}

/* ------------------------------------------------------
   Protected route wrapper for dashboard
------------------------------------------------------ */
function ProtectedDashboard() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const active = instance.getActiveAccount();

    if (!active && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
    }

    // Simulate async session check
    setTimeout(() => setChecking(false), 300);
  }, [instance, accounts]);

  if (checking) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#8a1538" }}>
        Checking session…
      </div>
    );
  }

  if (!isAuthenticated) {
    console.warn("No valid MSAL session, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <EnsureActiveAccount />
      <DashboardPage />
    </>
  );
}

/* ------------------------------------------------------
   Logout route (optional)
------------------------------------------------------ */
function LogoutNow() {
  const { instance, accounts } = useMsal();
  useEffect(() => {
    instance.logoutRedirect({
      account: instance.getActiveAccount() || accounts[0],
      postLogoutRedirectUri: window.location.origin,
    });
  }, [instance, accounts]);
  return null;
}

/* ------------------------------------------------------
   Main App Component
------------------------------------------------------ */
export default function App() {
  return (
    <DarkModeProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard/*" element={<ProtectedDashboard />} />
          <Route path="/logout" element={<LogoutNow />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </DarkModeProvider>
  );
}
