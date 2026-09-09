import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useMutation } from "../lib/useApi";
import { useToast } from "../theme";
import { Button, Field, PageHeader, fmtDate } from "../components/ui";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { push } = useToast();
  const [full_name, setName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [pw, setPw] = useState({ current: "", next: "" });

  const save = useMutation(() =>
    api("/auth/me", { method: "PATCH", body: { full_name, phone } }),
  );
  const changePw = useMutation(() =>
    api("/auth/me/password", {
      method: "POST",
      body: { current_password: pw.current, new_password: pw.next },
    }),
  );

  return (
    <>
      <PageHeader title="My Profile" />
      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <h2>Details</h2>
          </div>
          <div className="card-body stack-sm">
            <div className="dl">
              <div>
                <div className="dt">Email</div>
                <div className="dd">{user?.email}</div>
              </div>
              <div>
                <div className="dt">Role</div>
                <div className="dd">
                  <span className="badge">{user?.role}</span>
                </div>
              </div>
              <div>
                <div className="dt">Identifier</div>
                <div className="dd">{user?.identifier ?? "—"}</div>
              </div>
              <div>
                <div className="dt">Member since</div>
                <div className="dd">{fmtDate(user?.created_at)}</div>
              </div>
            </div>
            <hr />
            <Field label="Full name">
              <input value={full_name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Button
              loading={save.loading}
              onClick={async () => {
                const r = await save.run();
                if (r !== undefined) {
                  await refreshUser();
                  push("Profile updated", "ok");
                } else push("Could not save", "err");
              }}
            >
              Save changes
            </Button>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Change password</h2>
          </div>
          <div className="card-body stack-sm">
            <Field label="Current password">
              <input
                type="password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
            </Field>
            <Field label="New password" hint="At least 8 characters">
              <input
                type="password"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
            </Field>
            <Button
              variant="secondary"
              loading={changePw.loading}
              onClick={async () => {
                const r = await changePw.run();
                if (r !== undefined) {
                  push("Password changed — sign in again", "ok");
                  setPw({ current: "", next: "" });
                } else push(changePw.error?.message ?? "Failed", "err");
              }}
            >
              Update password
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
