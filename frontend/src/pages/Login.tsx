import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { RequestError } from "../api/client";

const DEMO = [
  ["librarian@kle.edu", "Librarian"],
  ["asha@kle.edu", "Student"],
  ["prof.iyer@kle.edu", "Faculty"],
  ["admin@kle.edu", "Admin"],
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      nav("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof RequestError ? err.message : "Could not sign in",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" onSubmit={submit}>
        <div>
          <h1>KLE Institute Library</h1>
          <p className="muted">Sign in to continue</p>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input
            id="pw"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="muted" style={{ fontSize: 13 }}>
          New student or faculty? <Link to="/register">Create an account</Link>
        </p>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Demo accounts — password <code>Password123</code>
          </p>
          <div className="suggested">
            {DEMO.map(([addr, label]) => (
              <button
                type="button"
                key={addr}
                onClick={() => {
                  setEmail(addr);
                  setPassword("Password123");
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
