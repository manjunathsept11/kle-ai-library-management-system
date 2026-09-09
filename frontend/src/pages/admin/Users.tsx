import { useState } from "react";
import { api } from "../../api/client";
import { useApi, useMutation } from "../../lib/useApi";
import { usePagedQuery } from "../../lib/usePagedQuery";
import { useToast } from "../../theme";
import {
  Button,
  Empty,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Pager,
  SkeletonRows,
  StatusBadge,
  fmtDate,
} from "../../components/ui";
import type { AdminUser, Department } from "../../api/types";

const ROLES = ["student", "faculty", "librarian", "admin"];

export default function Users() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const { push } = useToast();
  const depts = useApi<Department[]>("/admin/departments");
  const { data, loading, error, page, pages, setPage, reload } =
    usePagedQuery<AdminUser>("/admin/users", { q, role, status }, 25);

  const [edit, setEdit] = useState<AdminUser | "new" | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [newPw, setNewPw] = useState("");

  const deptName = (id: string | null) =>
    depts.data?.find((d) => d.id === id)?.code ?? "—";

  const save = useMutation(() => {
    if (edit === "new") {
      return api("/admin/users", {
        method: "POST",
        body: {
          email: form.email,
          full_name: form.full_name,
          role: form.role || "student",
          password: form.password,
          identifier: form.identifier || null,
          department_id: form.department_id || null,
          phone: form.phone || null,
        },
      });
    }
    const u = edit as AdminUser;
    const body: Record<string, unknown> = {};
    if (form.full_name !== u.full_name) body.full_name = form.full_name;
    if (form.role !== u.role) body.role = form.role;
    if (form.status !== u.status) body.status = form.status;
    if (form.identifier !== (u.identifier ?? ""))
      body.identifier = form.identifier || null;
    if (form.phone !== (u.phone ?? "")) body.phone = form.phone || null;
    if ((form.department_id || "") !== (u.department_id ?? ""))
      body.department_id = form.department_id || null;
    const lim = form.borrow_limit_override;
    if (lim !== (u.borrow_limit_override?.toString() ?? ""))
      body.borrow_limit_override = lim === "" ? null : Number(lim);
    if (form.staff_notes !== (u.staff_notes ?? ""))
      body.staff_notes = form.staff_notes || null;
    return api(`/admin/users/${u.id}`, { method: "PATCH", body });
  });
  const doReset = useMutation((id: string) =>
    api(`/admin/users/${id}/reset-password`, {
      method: "POST",
      body: { new_password: newPw },
    }),
  );

  function openEdit(u: AdminUser | "new") {
    setEdit(u);
    if (u === "new")
      setForm({ role: "student", email: "", full_name: "", password: "" });
    else
      setForm({
        full_name: u.full_name,
        role: u.role,
        status: u.status,
        identifier: u.identifier ?? "",
        phone: u.phone ?? "",
        department_id: u.department_id ?? "",
        borrow_limit_override: u.borrow_limit_override?.toString() ?? "",
        staff_notes: u.staff_notes ?? "",
      });
  }

  return (
    <>
      <PageHeader
        title="Users"
        sub="Manage members and staff accounts"
        actions={<Button onClick={() => openEdit("new")}>+ Add user</Button>}
      />
      <div className="card">
        <div className="card-head row wrap">
          <input
            placeholder="Name, email or ID…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            style={{ maxWidth: 220 }}
          />
          <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} style={{ maxWidth: 140 }}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ maxWidth: 140 }}>
            <option value="">Any status</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="pending">pending</option>
          </select>
        </div>
        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorBox error={error} />
        ) : data && data.items.length ? (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Dept</th>
                    <th>Status</th>
                    <th>Last login</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.full_name}
                        {u.identifier && (
                          <span className="muted small"> · {u.identifier}</span>
                        )}
                      </td>
                      <td className="muted small">{u.email}</td>
                      <td>
                        <span className="badge">{u.role}</span>
                      </td>
                      <td>{deptName(u.department_id)}</td>
                      <td>
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="muted small">
                        {u.last_login_at ? fmtDate(u.last_login_at) : "never"}
                      </td>
                      <td>
                        <div className="row-tight">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEdit(u)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setResetFor(u);
                              setNewPw("");
                            }}
                          >
                            Reset PW
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} total={data.total} onPage={setPage} />
          </>
        ) : (
          <Empty icon="◈">No users match.</Empty>
        )}
      </div>

      {edit && (
        <Modal
          title={edit === "new" ? "Add user" : `Edit ${(edit as AdminUser).full_name}`}
          onClose={() => setEdit(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button
                loading={save.loading}
                onClick={async () => {
                  const r = await save.run();
                  if (r !== undefined) {
                    push("Saved", "ok");
                    setEdit(null);
                    reload();
                  } else push(save.error?.message ?? "Failed", "err");
                }}
              >
                Save
              </Button>
            </>
          }
        >
          {edit === "new" && (
            <>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Temporary password">
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
            </>
          )}
          <Field label="Full name">
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>
          <div className="row">
            <Field label="Role">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            {edit !== "new" && (
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="pending">pending</option>
                </select>
              </Field>
            )}
          </div>
          <div className="row">
            <Field label="Identifier">
              <input
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
          <div className="row">
            <Field label="Department">
              <select
                value={form.department_id}
                onChange={(e) =>
                  setForm({ ...form, department_id: e.target.value })
                }
              >
                <option value="">—</option>
                {(depts.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            {edit !== "new" && (
              <Field label="Borrow limit override" hint="Blank = use role default">
                <input
                  type="number"
                  value={form.borrow_limit_override}
                  onChange={(e) =>
                    setForm({ ...form, borrow_limit_override: e.target.value })
                  }
                />
              </Field>
            )}
          </div>
          {edit !== "new" && (
            <Field label="Staff notes">
              <textarea
                value={form.staff_notes}
                onChange={(e) =>
                  setForm({ ...form, staff_notes: e.target.value })
                }
              />
            </Field>
          )}
        </Modal>
      )}

      {resetFor && (
        <Modal
          title={`Reset password · ${resetFor.full_name}`}
          onClose={() => setResetFor(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setResetFor(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={doReset.loading}
                onClick={async () => {
                  const r = await doReset.run(resetFor.id);
                  if (r !== undefined) {
                    push("Password reset — share it securely", "ok");
                    setResetFor(null);
                  } else push(doReset.error?.message ?? "Failed", "err");
                }}
              >
                Reset
              </Button>
            </>
          }
        >
          <Field label="New password" hint="At least 8 characters">
            <input
              type="text"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </Field>
          <p className="muted small">
            All the member's sessions will be signed out.
          </p>
        </Modal>
      )}
    </>
  );
}
