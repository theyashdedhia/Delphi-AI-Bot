import React, { useState } from "react";
import "./App.css";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="app">
      {/* Brand hero sits on the gradient (white text is visible) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          marginBottom: 18,
          textAlign: "center",
        }}
      >
        <img
          style={{
            width: 96,
            height: 96,
            borderRadius: 20,
            objectFit: "cover",
            boxShadow: "0 2px 6px rgba(0,0,0,.12)",
            marginBottom: 10,
            background: "#fff",
          }}
          src="https://tse1.mm.bing.net/th/id/OIP.Tr6Kd-kXuj8z9gf7rAVOBgHaDO?pid=Api&P=0&h=180"
          alt="Lifeblood AU"
        />
        <h2
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 800,
            color: "#fff",
            textShadow: "0 1px 10px rgba(0,0,0,.15)",
          }}
        >
          Welcome,
        </h2>
        <p
          style={{
            margin: "6px 0 0",
            opacity: 0.95,
            color: "#ffe9ed",
          }}
        >
          Glad to see you on <b>Delphi</b>!
        </p>
      </div>

      {/* Card with the actual form */}
      <section className="card">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="btn btn-primary" type="button">
          Sign in
        </button>

        <div className="divider">
          <span></span>
          <p>or continue with</p>
          <span></span>
        </div>

        <button
          className="btn btn-outline"
          type="button"
          aria-label="Sign in with Microsoft"
          onClick={() => alert("Microsoft OAuth")}
        >
          <span
            style={{
              display: "grid",
              gridTemplateColumns: "14px 14px",
              gridTemplateRows: "14px 14px",
              gap: "3px",
              marginRight: "8px",
            }}
            aria-hidden="true"
          >
            <span style={{ background: "#f25022", width: 14, height: 14, borderRadius: 2 }} />
            <span style={{ background: "#7fba00", width: 14, height: 14, borderRadius: 2 }} />
            <span style={{ background: "#00a4ef", width: 14, height: 14, borderRadius: 2 }} />
            <span style={{ background: "#ffb900", width: 14, height: 14, borderRadius: 2 }} />
          </span>
          <span>Microsoft</span>
        </button>
      </section>
    </main>
  );
}
