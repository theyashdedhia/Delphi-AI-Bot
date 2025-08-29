
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import Login from "./Login";

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import msalConfig from "./authConfig";
import { loginRequest } from "./authConfig";

const msalInstance = new PublicClientApplication(msalConfig);

// optional: expose a helper so Login.js can call it without importing hooks
window.__msalLogin = () => msalInstance.loginRedirect(loginRequest);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <Login />
    </MsalProvider>
  </React.StrictMode>
);
