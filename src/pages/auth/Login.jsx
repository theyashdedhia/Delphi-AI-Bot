
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../../authConfig";

export default function Login() {
  const navigate = useNavigate();
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts, inProgress } = useMsal();

  // After sign-in, wait for MSAL to finish, set active account, then go to dashboard
  useEffect(() => {
    if (inProgress === InteractionStatus.None && isAuthenticated) {
      if (accounts.length && !instance.getActiveAccount()) {
        instance.setActiveAccount(accounts[0]);
      }
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, inProgress, accounts, instance, navigate]);

  const handleMicrosoftLogin = () => {
    instance.loginRedirect({
      ...loginRequest,
      redirectUri: window.location.origin, // e.g., https://localhost:3000
    });
  };

  const handleLogout = () => {
    const account = instance.getActiveAccount() || accounts[0];
    instance.logoutRedirect({
      account,
      postLogoutRedirectUri: window.location.origin, // e.g., https://localhost:3000
    });
  };

  return (
    <main className="auth" role="main">
      <section className="auth__panel" aria-labelledby="welcome-title">
        <div className="panel__inner">
          <div className="brandword">DELPHI</div>
          <p className="brandtagline">Decision insights for Lifeblood</p>
          <h1 id="welcome-title" className="panel__title">Welcome back</h1>
          <p className="panel__sub strong">Please sign in to continue</p>

          {!isAuthenticated ? (
            <button
              type="button"
              className="btn btn--microsoft btn--maroon-border"
              onClick={handleMicrosoftLogin}
              aria-label="Sign in with Microsoft"
            >
              <span className="ms-mark" aria-hidden="true">
                <span className="sq sq--red" />
                <span className="sq sq--green" />
                <span className="sq sq--blue" />
                <span className="sq sq--yellow" />
              </span>
              <span className="btn__text">Sign in with Microsoft</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--maroon-border"
              onClick={handleLogout}
            >
              Sign out
            </button>
          )}

          <p className="legal">
            By continuing, you agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
          </p>
        </div>
      </section>

      <aside className="auth__media" aria-label="Brand illustration">
        <img
          className="media__img"
          src="https://www.maroondah.vic.gov.au/files/content/mycity/v/1/directory/australian-red-cross-lifeblood-ringwood/donorcentre_popup_socialtile.png?dimension=pageimage&w=480"
          alt=""
          aria-hidden="true"
        />
        <div className="media__overlay" aria-hidden="true" />
      </aside>
    </main>
  );
}
