import { useState } from "react";
import { api } from "../../api/client";
import { useApi, useMutation } from "../../lib/useApi";
import { useToast } from "../../theme";
import {
  Button,
  Empty,
  Field,
  Modal,
  PageHeader,
  SkeletonRows,
} from "../../components/ui";
import type { Department } from "../../api/types";

export default function Departments() {
  const { data, loading, reload } = useApi<Department[]>("/admin/departments");
  const { push } = useToast();
  const [modal, setModal] = useState<Department | "new" | null>(null);
  const [form, setForm] = useState({ name: "", code: "" });

  const save = useMutation(() =>
    modal === "new"
      ? api("/admin/departments", { method: "POST", body: form })
      : api(`/admin/departments/${(modal as Department).id}`, {
          method: "PATCH",
          body: form,
        }),
  );
  const del = useMutation((id: string) =>
    api(`/admin/departments/${id}`, { method: "DELETE" }),
  );

  return (
    <>
      <PageHeader
        title="Departments"
        sub="Academic departments and programs"
        actions={
          <Button
            onClick={() => {
              setForm({ name: "", code: "" });
              setModal("new");
            }}
          >
            + New department
          </Button>
        }
      />
      <div className="card">
        {loading ? (
          <SkeletonRows />
        ) : data && data.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.code}</strong>
                    </td>
                    <td>{d.name}</td>
                    <td>
                      <div className="row-tight">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setForm({ name: d.name, code: d.code });
                            setModal(d);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const r = await del.run(d.id);
                            if (r !== undefined) {
                              push("Deleted", "ok");
                              reload();
                            } else
                              push(del.error?.message ?? "In use", "err");
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="⬡">No departments.</Empty>
        )}
      </div>

      {modal && (
        <Modal
          title={modal === "new" ? "New department" : "Edit department"}
          onClose={() => setModal(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button
                loading={save.loading}
                onClick={async () => {
                  const r = await save.run();
                  if (r !== undefined) {
                    push("Saved", "ok");
                    setModal(null);
                    reload();
                  } else push(save.error?.message ?? "Failed", "err");
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Code" hint="Short, uppercase — e.g. BCA">
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
        </Modal>
      )}
    </>
  );
}
