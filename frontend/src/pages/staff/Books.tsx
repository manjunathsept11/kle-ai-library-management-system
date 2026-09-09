import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useMutation } from "../../lib/useApi";
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
} from "../../components/ui";
import type { BookDetail, BookSummary } from "../../api/types";

const blank = {
  title: "",
  subtitle: "",
  isbn: "",
  authors: "",
  category_name: "",
  publisher_name: "",
  publication_year: "",
  language: "English",
  subject: "",
  description: "",
  keywords: "",
  initial_copies: "2",
  shelf_location: "",
};

export default function Books() {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const { push } = useToast();
  const { data, loading, error, page, pages, setPage, reload } =
    usePagedQuery<BookSummary>(
      "/books",
      { q, include_archived: true },
      20,
    );

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  const create = useMutation(() =>
    api<BookDetail>("/books", {
      method: "POST",
      body: {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        isbn: form.isbn.trim() || null,
        authors: form.authors.split(",").map((s) => s.trim()).filter(Boolean),
        category_name: form.category_name.trim() || null,
        publisher_name: form.publisher_name.trim() || null,
        publication_year: form.publication_year
          ? Number(form.publication_year)
          : null,
        language: form.language,
        subject: form.subject.trim() || null,
        description: form.description.trim() || null,
        keywords: form.keywords.trim() || null,
        initial_copies: Number(form.initial_copies) || 0,
        shelf_location: form.shelf_location.trim() || null,
      },
    }),
  );
  const archive = useMutation((id: string) =>
    api(`/books/${id}`, { method: "DELETE" }),
  );

  return (
    <>
      <PageHeader
        title="Book Management"
        sub="Add, edit and archive catalogue titles"
        actions={
          <Button onClick={() => { setForm(blank); setOpen(true); }}>
            + Add book
          </Button>
        }
      />

      <div className="card">
        <div className="card-head">
          <input
            placeholder="Search titles…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            style={{ maxWidth: 280 }}
          />
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
                    <th>Title</th>
                    <th>Author(s)</th>
                    <th>Year</th>
                    <th className="num">Copies</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <Link to={`/books/${b.id}`}>{b.title}</Link>
                      </td>
                      <td className="muted small">
                        {b.author_names.join(", ")}
                      </td>
                      <td>{b.publication_year ?? "—"}</td>
                      <td className="num">
                        {b.available_copies}/{b.total_copies}
                      </td>
                      <td>
                        <StatusBadge status={b.status} />
                      </td>
                      <td>
                        <div className="row-tight">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => nav(`/books/${b.id}`)}
                          >
                            Open
                          </Button>
                          {b.status === "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const r = await archive.run(b.id);
                                if (r !== undefined) {
                                  push("Book archived", "ok");
                                  reload();
                                } else
                                  push(
                                    archive.error?.message ?? "Cannot archive",
                                    "err",
                                  );
                              }}
                            >
                              Archive
                            </Button>
                          )}
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
          <Empty icon="▤">No books found.</Empty>
        )}
      </div>

      {open && (
        <Modal
          title="Add a book"
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                loading={create.loading}
                onClick={async () => {
                  const r = await create.run();
                  if (r !== undefined) {
                    push(`Added “${r.title}”`, "ok");
                    setOpen(false);
                    reload();
                    nav(`/books/${r.id}`);
                  } else push(create.error?.message ?? "Failed", "err");
                }}
              >
                Add book
              </Button>
            </>
          }
        >
          <p className="muted small">
            The book is indexed for AI search automatically.
          </p>
          <Field label="Title *">
            <input value={form.title} onChange={set("title")} />
          </Field>
          <div className="row">
            <Field label="Subtitle">
              <input value={form.subtitle} onChange={set("subtitle")} />
            </Field>
            <Field label="ISBN">
              <input value={form.isbn} onChange={set("isbn")} />
            </Field>
          </div>
          <Field label="Authors (comma-separated)">
            <input
              value={form.authors}
              onChange={set("authors")}
              placeholder="Robert C. Martin, Kent Beck"
            />
          </Field>
          <div className="row">
            <Field label="Category">
              <input value={form.category_name} onChange={set("category_name")} />
            </Field>
            <Field label="Publisher">
              <input
                value={form.publisher_name}
                onChange={set("publisher_name")}
              />
            </Field>
            <Field label="Year">
              <input
                type="number"
                value={form.publication_year}
                onChange={set("publication_year")}
              />
            </Field>
          </div>
          <div className="row">
            <Field label="Subject">
              <input value={form.subject} onChange={set("subject")} />
            </Field>
            <Field label="Language">
              <input value={form.language} onChange={set("language")} />
            </Field>
          </div>
          <Field label="Keywords (help AI search)">
            <input value={form.keywords} onChange={set("keywords")} />
          </Field>
          <Field label="Description">
            <textarea
              rows={3}
              value={form.description}
              onChange={set("description")}
            />
          </Field>
          <div className="row">
            <Field label="Initial copies">
              <input
                type="number"
                min={0}
                value={form.initial_copies}
                onChange={set("initial_copies")}
              />
            </Field>
            <Field label="Shelf label">
              <input
                value={form.shelf_location}
                onChange={set("shelf_location")}
              />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}
