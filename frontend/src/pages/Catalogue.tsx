import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../lib/useApi";
import { Empty, ErrorBox, Loading } from "../components/ui";
import type { BookSummary, Page } from "../api/types";

export default function Catalogue() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") ?? "1");
  const availableOnly = params.get("available") === "1";
  const [input, setInput] = useState(q);

  const query = new URLSearchParams({
    page: String(page),
    page_size: "18",
  });
  if (q) query.set("q", q);
  if (availableOnly) query.set("available_only", "true");

  const { data, loading, error } = useApi<Page<BookSummary>>(
    `/books?${query.toString()}`,
  );

  const update = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="stack">
      <h1>Catalogue</h1>

      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: input || null, page: "1" });
        }}
      >
        <input
          placeholder="Search by title, author, ISBN, keyword…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "0 0 auto",
            margin: 0,
          }}
        >
          <input
            type="checkbox"
            style={{ width: 16 }}
            checked={availableOnly}
            onChange={(e) =>
              update({ available: e.target.checked ? "1" : null, page: "1" })
            }
          />
          Available only
        </label>
        <button type="submit" style={{ flex: "0 0 auto" }}>
          Search
        </button>
        <Link
          to="/ai-search"
          className="btn secondary"
          style={{ flex: "0 0 auto", alignSelf: "center" }}
        >
          ✦ Try AI Smart Search
        </Link>
      </form>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} />
      ) : data && data.items.length ? (
        <>
          <p className="muted">{data.total} title(s)</p>
          <div className="book-grid">
            {data.items.map((b) => (
              <Link to={`/books/${b.id}`} key={b.id} className="card book-card">
                <h3>{b.title}</h3>
                <div className="authors">
                  {b.author_names.join(", ") || "Unknown author"}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {b.publication_year ?? ""} · {b.language}
                </div>
                <div className="foot">
                  <span
                    className={`badge ${b.available_copies ? "ok" : "danger"}`}
                  >
                    {b.available_copies}/{b.total_copies} available
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="spread">
            <button
              className="secondary"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
            >
              ← Prev
            </button>
            <span className="muted">
              Page {page} of {totalPages}
            </span>
            <button
              className="secondary"
              disabled={page >= totalPages}
              onClick={() => update({ page: String(page + 1) })}
            >
              Next →
            </button>
          </div>
        </>
      ) : (
        <Empty>No books match your search.</Empty>
      )}
    </div>
  );
}
