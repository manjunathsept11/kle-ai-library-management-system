import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useMutation } from "../lib/useApi";
import { ErrorBox, Toast } from "../components/ui";
import type { BookDetail } from "../api/types";

const empty = {
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

export default function StaffBooks() {
  const nav = useNavigate();
  const [form, setForm] = useState(empty);
  const [toast, setToast] = useState<string | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: { target: { value: string } }) =>
      setForm({ ...form, [k]: e.target.value });

  const create = useMutation(() =>
    api<BookDetail>("/books", {
      method: "POST",
      body: {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        isbn: form.isbn.trim() || null,
        authors: form.authors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await create.run();
    if (r) {
      setForm(empty);
      setToast(`Added “${r.title}” with ${r.total_copies} copies`);
      setTimeout(() => nav(`/books/${r.id}`), 800);
    }
  }

  return (
    <div className="stack">
      <h1>Add a book</h1>
      <p className="muted">
        The book is indexed for AI search automatically in the background.
      </p>

      <form className="card stack" onSubmit={submit}>
        {create.error && <ErrorBox error={create.error} />}

        <div className="field">
          <label>Title *</label>
          <input value={form.title} onChange={set("title")} required />
        </div>
        <div className="row">
          <div className="field">
            <label>Subtitle</label>
            <input value={form.subtitle} onChange={set("subtitle")} />
          </div>
          <div className="field">
            <label>ISBN</label>
            <input value={form.isbn} onChange={set("isbn")} />
          </div>
        </div>
        <div className="field">
          <label>Authors (comma-separated)</label>
          <input
            value={form.authors}
            onChange={set("authors")}
            placeholder="Robert C. Martin, Kent Beck"
          />
        </div>
        <div className="row">
          <div className="field">
            <label>Category</label>
            <input value={form.category_name} onChange={set("category_name")} />
          </div>
          <div className="field">
            <label>Publisher</label>
            <input
              value={form.publisher_name}
              onChange={set("publisher_name")}
            />
          </div>
          <div className="field">
            <label>Year</label>
            <input
              type="number"
              value={form.publication_year}
              onChange={set("publication_year")}
            />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Subject</label>
            <input value={form.subject} onChange={set("subject")} />
          </div>
          <div className="field">
            <label>Language</label>
            <input value={form.language} onChange={set("language")} />
          </div>
        </div>
        <div className="field">
          <label>Keywords (helps AI search)</label>
          <input value={form.keywords} onChange={set("keywords")} />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={set("description")}
          />
        </div>
        <div className="row">
          <div className="field">
            <label>Initial copies</label>
            <input
              type="number"
              min={0}
              value={form.initial_copies}
              onChange={set("initial_copies")}
            />
          </div>
          <div className="field">
            <label>Shelf location</label>
            <input
              value={form.shelf_location}
              onChange={set("shelf_location")}
            />
          </div>
        </div>

        <button type="submit" disabled={create.loading}>
          {create.loading ? "Saving…" : "Add book"}
        </button>
      </form>

      {toast && <Toast message={toast} />}
    </div>
  );
}
