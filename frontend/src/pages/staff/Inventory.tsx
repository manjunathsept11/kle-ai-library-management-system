import { useState } from "react";
import { Link } from "react-router-dom";
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
  money,
} from "../../components/ui";
import type { CopyRow, Shelf } from "../../api/types";

const STATUSES = [
  "available",
  "issued",
  "reserved",
  "lost",
  "damaged",
  "maintenance",
  "archived",
];
const CONDITIONS = ["new", "good", "fair", "poor"];

export default function Inventory() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const { push } = useToast();
  const shelves = useApi<Shelf[]>("/shelves");
  const { data, loading, error, page, pages, setPage, reload } =
    usePagedQuery<CopyRow>("/copies", { q, status }, 30);

  const [edit, setEdit] = useState<CopyRow | null>(null);
  const [form, setForm] = useState({
    status: "",
    condition: "",
    shelf_id: "",
    notes: "",
    price: "",
  });

  const save = useMutation((id: string) =>
    api(`/copies/${id}`, {
      method: "PATCH",
      body: {
        ...(form.status ? { status: form.status } : {}),
        ...(form.condition ? { condition: form.condition } : {}),
        ...(form.shelf_id ? { shelf_id: form.shelf_id } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
        ...(form.price ? { price: Number(form.price) } : {}),
      },
    }),
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        sub="Every physical copy, its shelf and condition"
      />
      <div className="card">
        <div className="card-head row" style={{ flexWrap: "wrap" }}>
          <input
            placeholder="Title or barcode…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            style={{ maxWidth: 260 }}
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            style={{ maxWidth: 180 }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
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
                    <th>Barcode</th>
                    <th>Title</th>
                    <th>Shelf</th>
                    <th>Condition</th>
                    <th>Status</th>
                    <th className="num">Price</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <code>{c.barcode}</code>
                      </td>
                      <td>
                        <Link to={`/books/${c.book_id}`}>{c.book_title}</Link>
                      </td>
                      <td>{c.shelf_code ?? c.shelf_location ?? "—"}</td>
                      <td>{c.condition}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="num">{c.price ? money(c.price) : "—"}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEdit(c);
                            setForm({
                              status: c.status,
                              condition: c.condition,
                              shelf_id: c.shelf_id ?? "",
                              notes: c.notes ?? "",
                              price: c.price ? String(c.price) : "",
                            });
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} total={data.total} onPage={setPage} />
          </>
        ) : (
          <Empty icon="▣">No copies match.</Empty>
        )}
      </div>

      {edit && (
        <Modal
          title={`Copy ${edit.barcode}`}
          onClose={() => setEdit(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button
                loading={save.loading}
                onClick={async () => {
                  const r = await save.run(edit.id);
                  if (r !== undefined) {
                    push("Copy updated", "ok");
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
          <div className="row">
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Condition">
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
              >
                {CONDITIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Shelf">
            <select
              value={form.shelf_id}
              onChange={(e) => setForm({ ...form, shelf_id: e.target.value })}
            >
              <option value="">— unassigned —</option>
              {(shelves.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="row">
            <Field label="Price">
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </Modal>
      )}
    </>
  );
}
