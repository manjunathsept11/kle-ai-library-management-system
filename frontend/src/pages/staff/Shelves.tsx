import { useState } from "react";
import { api } from "../../api/client";
import { useApi, useMutation } from "../../lib/useApi";
import { useToast } from "../../theme";
import {
  Button,
  Empty,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  SkeletonRows,
} from "../../components/ui";
import type { Copy, Shelf } from "../../api/types";

const blank = {
  code: "",
  name: "",
  location: "",
  capacity: "",
  description: "",
};

export default function Shelves() {
  const { data, loading, error, reload } = useApi<Shelf[]>("/shelves");
  const { push } = useToast();
  const [edit, setEdit] = useState<Shelf | "new" | null>(null);
  const [form, setForm] = useState(blank);
  const [view, setView] = useState<Shelf | null>(null);
  const copies = useApi<Copy[]>(view ? `/shelves/${view.id}/copies` : null);

  const save = useMutation(() => {
    const body = {
      name: form.name,
      location: form.location || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      description: form.description || null,
    };
    return edit === "new"
      ? api("/shelves", { method: "POST", body: { ...body, code: form.code } })
      : api(`/shelves/${(edit as Shelf).id}`, { method: "PATCH", body });
  });
  const del = useMutation((id: string) =>
    api(`/shelves/${id}`, { method: "DELETE" }),
  );

  return (
    <>
      <PageHeader
        title="Shelves"
        sub="Physical storage locations"
        actions={
          <Button
            onClick={() => {
              setForm(blank);
              setEdit("new");
            }}
          >
            + New shelf
          </Button>
        }
      />
      {loading ? (
        <SkeletonRows />
      ) : error ? (
        <ErrorBox error={error} />
      ) : data && data.length ? (
        <div className="grid cols-3">
          {data.map((s) => (
            <div key={s.id} className="card card-pad stack-sm">
              <div className="spread">
                <strong>{s.code}</strong>
                <span className="badge">{s.copy_count} copies</span>
              </div>
              <div>{s.name}</div>
              <div className="muted small">{s.location ?? "—"}</div>
              {s.capacity != null && (
                <div className="meter">
                  <span
                    className={
                      s.copy_count / s.capacity > 0.9
                        ? "danger"
                        : s.copy_count / s.capacity > 0.7
                          ? "warn"
                          : ""
                    }
                    style={{
                      width: `${Math.min(100, (s.copy_count / s.capacity) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <div className="row-tight">
                <Button size="sm" variant="secondary" onClick={() => setView(s)}>
                  View copies
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEdit(s);
                    setForm({
                      code: s.code,
                      name: s.name,
                      location: s.location ?? "",
                      capacity: s.capacity ? String(s.capacity) : "",
                      description: s.description ?? "",
                    });
                  }}
                >
                  Edit
                </Button>
                {s.copy_count === 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await del.run(s.id);
                      push("Shelf deleted", "ok");
                      reload();
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="☷">No shelves yet.</Empty>
      )}

      {edit && (
        <Modal
          title={edit === "new" ? "New shelf" : `Edit ${(edit as Shelf).code}`}
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
            <Field label="Code *" hint="Short, e.g. A1, REF">
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
          )}
          <Field label="Name *">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Location">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          <Field label="Capacity">
            <input
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </Modal>
      )}

      {view && (
        <Modal
          title={`${view.code} — copies`}
          wide
          onClose={() => setView(null)}
        >
          {copies.loading ? (
            <SkeletonRows />
          ) : copies.data && copies.data.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Barcode</th>
                    <th>Status</th>
                    <th>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {copies.data.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <code>{c.barcode}</code>
                      </td>
                      <td>{c.status}</td>
                      <td>{c.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No copies on this shelf.</Empty>
          )}
        </Modal>
      )}
    </>
  );
}
