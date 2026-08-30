"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.ok) {
        router.replace("/admin/dashboard");
        router.refresh();
      } else {
        setError(data.error || "Login failed");
        setBusy(false);
      }
    } catch {
      setError("Could not reach the server. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-head">
          <div className="logo">
            <span className="dot">B</span>
            <span>bikepick.in</span>
          </div>
          <div className="sub">Admin Console — sign in to manage the catalog</div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="field">
          <label htmlFor="u">Username</label>
          <input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="admin" />
        </div>
        <div className="field">
          <label htmlFor="p">Password</label>
          <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
        </div>

        <button className="btn btn-primary" style={{ width: "100%", marginTop: 6 }} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

      </form>
    </main>
  );
}
