import React, { useState } from "react";
import "./App.css";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="app">
      <section className="card">
        <div className="brand">
          <img
            src="https://tse1.mm.bing.net/th/id/OIP.Tr6Kd-kXuj8z9gf7rAVOBgHaDO?pid=Api&P=0&h=180"
            alt="Lifeblood AU"
          />
          <h2>Delphi</h2>
        </div>

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

        <button className="btn btn-primary" type="button">Sign in</button>

        <div className="divider">
          <span></span>
          <p>or continue with</p>
          <span></span>
        </div>

        <button className="btn btn-outline" type="button">Microsoft</button>
      </section>
    </main>
  );
}
