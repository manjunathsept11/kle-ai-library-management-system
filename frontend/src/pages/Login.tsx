import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme";
import { RequestError } from "../api/client";
import { Button, Field } from "../components/ui";

const DEMO: [string, string][] = [
  ["asha@kle.edu", "Student"],
  ["prof.iyer@kle.edu", "Faculty"],
  ["librarian@kle.edu", "Librarian"],
  ["admin@kle.edu", "Admin"],
];

const FEATURES = [
  ["✦", "Natural-language semantic search across the whole catalogue"],
  ["✦", "A 24×7 AI assistant grounded in library data — never guesswork"],
  ["▦", "Reservations, renewals, fines and history in one place"],
  ["▣", "Real-time inventory, shelves and circulation for staff"],
];

export default function Login() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
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
      setError(err instanceof RequestError ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="aurora" aria-hidden />
        <div className="brand-row">
          <span className="mark">KL</span> KLE Institute Library
        </div>
        <div>
          <div className="lead">The library, made intelligent.</div>
          <div className="auth-features" style={{ marginTop: 22 }}>
            {FEATURES.map(([i, t]) => (
              <div className="f" key={t}>
                <span className="fi">{i}</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="small" style={{ opacity: 0.7 }}>
          A demonstration system. All data is fictional.
        </div>
      </aside>

      <main className="auth-main">
        <form className="card card-pad auth-card stack" onSubmit={submit}>
          <div className="spread">
            <div>
              <h1>Welcome back</h1>
              <p className="muted small" style={{ margin: 0 }}>
                Sign in to your library account
              </p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={toggle}
              aria-label="Theme"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>

          {error && <div className="callout danger">{error}</div>}

          <Field label="Email">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@kle.edu"
              required
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>

          <Button type="submit" block loading={busy}>
            Sign in
          </Button>

          <p className="muted small center" style={{ margin: 0 }}>
            New student or faculty? <Link to="/register">Create an account</Link>
          </p>

          <div className="auth-demo">
            <p className="muted small" style={{ marginBottom: 6 }}>
              Demo accounts — password <code>Password123</code>
            </p>
            <div className="chip-row">
              {DEMO.map(([addr, label]) => (
                <button
                  type="button"
                  key={addr}
                  className="chip"
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
      </main>
    </div>
  );
}
