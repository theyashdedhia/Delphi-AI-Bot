import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./pages/Dashboard/DashboardPage.jsx";
import Login from "./pages/auth/Login.jsx";
import { DarkModeProvider } from './contexts/DarkModeContext.jsx';
import { MsalAuthenticationTemplate, useMsal } from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";
import { loginRequest } from "./authConfig";

// Inline logout route (no new file)
function LogoutNow() {
  const { instance, accounts } = useMsal();
  useEffect(() => {
    instance.logoutRedirect({
      account: instance.getActiveAccount() || accounts[0],
      postLogoutRedirectUri: window.location.origin, // https://localhost:3000
    });
  }, [instance, accounts]);
  return null;
}

export default function App() {
  return (
  <DarkModeProvider>
    <Router>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* Protected dashboard */}
        <Route
          path="/dashboard/*"
          element={
            <MsalAuthenticationTemplate
              interactionType={InteractionType.Redirect}
              authenticationRequest={{
                ...loginRequest,
                redirectUri: window.location.origin, // consistent redirect
              }}
              loadingComponent={<div style={{ padding: 24 }}>Signing you in…</div>}
              errorComponent={({ error }) => (
                <div style={{ padding: 24, color: "crimson" }}>
                  Auth error: {error?.message}
                </div>
              )}
            >
              <DashboardPage />
            </MsalAuthenticationTemplate>
          }
        />

        {/* Logout route (works from anywhere) */}
        <Route path="/logout" element={<LogoutNow />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  </DarkModeProvider>
  );
}
