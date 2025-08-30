
import React from "react";
import "./Login.css";



function handleMicrosoftLogin() {
  if (typeof window !== "undefined" && typeof window.__msalLogin === "function") {
    return window.__msalLogin();
  }
  alert("Microsoft OAuth (stub) — integrate MSAL when ready.");
}

export default function Login() {
  return (
    <main className="auth" role="main">
      {/* LEFT: content column */}
      <section className="auth__panel" aria-labelledby="welcome-title">
        <div className="panel__inner">
          {/* Brand wordmark (no logo) */}
          <div className="brandword">DELPHI</div>
          <p className="brandtagline">Decision insights for Lifeblood</p>

          {/* Headings */}
          <h1 id="welcome-title" className="panel__title">Welcome back</h1>
          <p className="panel__sub strong">Please sign in to continue</p>

          {/* Microsoft SSO */}
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

          {/* Legal */}
          <p className="legal">
            By continuing, you agree to the <a href="#">Terms</a> and{" "}
            <a href="#">Privacy Policy</a>.
          </p>
    


        </div>
      </section>

      {/* RIGHT: media column */}
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
