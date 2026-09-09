import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi, useMutation } from "../lib/useApi";
import { api } from "../api/client";
import {
  AiBadge,
  ErrorBox,
  Loading,
  StatusBadge,
  Toast,
  fmtDate,
} from "../components/ui";
import type { BookDetail as Book, SearchResponse } from "../api/types";

export default function BookDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const staff = user?.role === "librarian" || user?.role === "admin";
  const { data, loading, error, reload } = useApi<Book>(`/books/${id}`);
  const similar = useApi<SearchResponse>(
    data ? `/search?q=${encodeURIComponent(data.title)}&mode=semantic&limit=5` : null,
  );
  const [toast, setToast] = useState<{ m: string; t: "ok" | "err" } | null>(null);

  const addCopies = useMutation((n: number) =>
    api(`/books/${id}/copies`, { method: "POST", body: { count: n } }),
  );

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  return (
    <div className="stack">
      <Link to="/catalogue" className="muted">
        ← Back to catalogue
      </Link>

      <div className="card">
        <div className="spread" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>{data.title}</h1>
            {data.subtitle && <p className="muted">{data.subtitle}</p>}
            <p>{data.author_names.join(", ") || "Unknown author"}</p>
          </div>
          <span
            className={`badge ${data.available_copies ? "ok" : "danger"}`}
            style={{ fontSize: 13 }}
          >
            {data.available_copies}/{data.total_copies} available
          </span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label>ISBN</label>
            {data.isbn ?? "—"}
          </div>
          <div>
            <label>Publisher</label>
            {data.publisher?.name ?? "—"}
          </div>
          <div>
            <label>Edition</label>
            {data.edition ?? "—"}
          </div>
          <div>
            <label>Year</label>
            {data.publication_year ?? "—"}
          </div>
          <div>
            <label>Category</label>
            {data.category?.name ?? "—"}
          </div>
          <div>
            <label>Language</label>
            {data.language}
          </div>
        </div>

        {data.description && (
          <>
            <label style={{ marginTop: 12 }}>Description</label>
            <p>{data.description}</p>
          </>
        )}

        {data.ai_tags && data.ai_tags.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <AiBadge label="AI tags" />{" "}
            {data.ai_tags.map((t) => (
              <span key={t} className="badge" style={{ marginLeft: 4 }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Copies</h2>
        <table>
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Shelf</th>
              <th>Condition</th>
              <th>Status</th>
              <th>Acquired</th>
            </tr>
          </thead>
          <tbody>
            {data.copies.map((c) => (
              <tr key={c.id}>
                <td>
                  <code>{c.barcode}</code>
                </td>
                <td>{c.shelf_location ?? "—"}</td>
                <td>{c.condition}</td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td>{fmtDate(c.acquisition_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {staff && (
          <div style={{ marginTop: 12 }}>
            <button
              className="secondary"
              disabled={addCopies.loading}
              onClick={async () => {
                const r = await addCopies.run(1);
                if (r !== undefined) {
                  setToast({ m: "Copy added", t: "ok" });
                  reload();
                } else {
                  setToast({ m: "Could not add copy", t: "err" });
                }
              }}
            >
              + Add a copy
            </button>
          </div>
        )}
        {!staff && (
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            To borrow, visit the circulation desk with your library card.
          </p>
        )}
      </div>

      <div className="card">
        <h2>
          Similar books <AiBadge />
        </h2>
        {similar.loading ? (
          <Loading />
        ) : (
          <div className="book-grid" style={{ marginTop: 8 }}>
            {(similar.data?.results ?? [])
              .filter((r) => r.book.id !== data.id)
              .slice(0, 4)
              .map((r) => (
                <Link
                  to={`/books/${r.book.id}`}
                  key={r.book.id}
                  className="card book-card"
                >
                  <h3>{r.book.title}</h3>
                  <div className="authors">
                    {r.book.author_names.join(", ")}
                  </div>
                  <div className="foot">
                    <span className="reason">{r.reason}</span>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.m} tone={toast.t} />}
    </div>
  );
}
