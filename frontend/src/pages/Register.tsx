import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { RequestError } from "../api/client";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "student" as "student" | "faculty",
    identifier: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        identifier: form.identifier.trim() || undefined,
      });
      nav("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof RequestError ? err.message : "Could not register",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" onSubmit={submit}>
        <h1>Create your account</h1>
        {error && <div className="error-box">{error}</div>}

        <div className="field">
          <label>Full name</label>
          <input value={form.full_name} onChange={set("full_name")} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            required
          />
        </div>
        <div className="field">
          <label>Password (min 8 characters)</label>
          <input
            type="password"
            minLength={8}
            value={form.password}
            onChange={set("password")}
            required
          />
        </div>
        <div className="row">
          <div className="field">
            <label>I am a</label>
            <select value={form.role} onChange={set("role")}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
            </select>
          </div>
          <div className="field">
            <label>Roll / Employee no. (optional)</label>
            <input value={form.identifier} onChange={set("identifier")} />
          </div>
        </div>

        <button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="muted" style={{ fontSize: 13 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
