import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { RequestError } from "../api/client";
import { Button, Field } from "../components/ui";

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
      setError(err instanceof RequestError ? err.message : "Could not register");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="brand-row">
          <span className="mark">KL</span> KLE Institute Library
        </div>
        <div className="lead">Join the smart knowledge center.</div>
        <div className="small" style={{ opacity: 0.7 }}>
          Staff accounts are created by an administrator.
        </div>
      </aside>
      <main className="auth-main">
        <form className="card card-pad auth-card stack" onSubmit={submit}>
          <h1>Create your account</h1>
          {error && <div className="callout danger">{error}</div>}

          <Field label="Full name">
            <input value={form.full_name} onChange={set("full_name")} required />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={set("email")} required />
          </Field>
          <Field label="Password" hint="At least 8 characters">
            <input
              type="password"
              minLength={8}
              value={form.password}
              onChange={set("password")}
              required
            />
          </Field>
          <div className="row">
            <Field label="I am a">
              <select value={form.role} onChange={set("role")}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
            </Field>
            <Field label="Roll / Employee no.">
              <input value={form.identifier} onChange={set("identifier")} />
            </Field>
          </div>

          <Button type="submit" block loading={busy}>
            Create account
          </Button>
          <p className="muted small center" style={{ margin: 0 }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
