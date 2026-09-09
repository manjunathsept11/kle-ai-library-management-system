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
  Tabs,
} from "../../components/ui";
import type { Author, Category, Publisher } from "../../api/types";

type Tab = "categories" | "publishers" | "authors";

export default function Taxonomy() {
  const [tab, setTab] = useState<Tab>("categories");
  const { push } = useToast();

  const cats = useApi<Category[]>(tab === "categories" ? "/categories" : null);
  const pubs = useApi<Publisher[]>(tab === "publishers" ? "/publishers" : null);
  const authors = useApi<Author[]>(tab === "authors" ? "/authors" : null);

  const [modal, setModal] = useState<
    { kind: Tab; id?: string; name: string; code?: string } | null
  >(null);

  const save = useMutation(async () => {
    if (!modal) return;
    const { kind, id, name, code } = modal;
    if (kind === "categories") {
      return id
        ? api(`/categories/${id}`, { method: "PATCH", body: { name, code } })
        : api("/categories", { method: "POST", body: { name, code } });
    }
    if (kind === "publishers") {
      return id
        ? api(`/publishers/${id}`, { method: "PATCH", body: { name } })
        : api("/publishers", { method: "POST", body: { name } });
    }
    return api(`/authors/${id}`, { method: "PATCH", body: { name } });
  });
  const del = useMutation((kind: Tab, id: string) =>
    api(`/${kind}/${id}`, { method: "DELETE" }),
  );

  const refresh = () => {
    cats.reload();
    pubs.reload();
    authors.reload();
  };

  return (
    <>
      <PageHeader
        title="Categories, Publishers & Authors"
        sub="Manage catalogue taxonomy"
        actions={
          tab !== "authors" && (
            <Button
              onClick={() =>
                setModal({ kind: tab, name: "", code: "" })
              }
            >
              + New {tab === "categories" ? "category" : "publisher"}
            </Button>
          )
        }
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "categories", label: "Categories" },
          { id: "publishers", label: "Publishers" },
          { id: "authors", label: "Authors" },
        ]}
      />

      <div className="card">
        {(tab === "categories" ? cats.loading : tab === "publishers" ? pubs.loading : authors.loading) ? (
          <SkeletonRows />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  {tab === "categories" && <th>Code</th>}
                  <th className="num">Books</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(tab === "categories"
                  ? cats.data
                  : tab === "publishers"
                    ? pubs.data
                    : authors.data
                )?.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    {tab === "categories" && (
                      <td>{(row as Category).code ?? "—"}</td>
                    )}
                    <td className="num">{row.book_count}</td>
                    <td>
                      <div className="row-tight">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setModal({
                              kind: tab,
                              id: row.id,
                              name: row.name,
                              code: (row as Category).code ?? "",
                            })
                          }
                        >
                          Edit
                        </Button>
                        {tab !== "authors" && row.book_count === 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await del.run(tab, row.id);
                              push("Deleted", "ok");
                              refresh();
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(tab === "categories" ? cats.data : tab === "publishers" ? pubs.data : authors.data)
          ?.length === 0 && <Empty icon="❏">Nothing here yet.</Empty>}
      </div>

      {modal && (
        <Modal
          title={`${modal.id ? "Edit" : "New"} ${modal.kind.slice(0, -1)}`}
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
                    refresh();
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
              value={modal.name}
              onChange={(e) => setModal({ ...modal, name: e.target.value })}
            />
          </Field>
          {modal.kind === "categories" && (
            <Field label="Code (optional)">
              <input
                value={modal.code}
                onChange={(e) => setModal({ ...modal, code: e.target.value })}
              />
            </Field>
          )}
        </Modal>
      )}
    </>
  );
}
