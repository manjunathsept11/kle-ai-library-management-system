import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../lib/useApi";
import {
  Empty,
  ErrorBox,
  PageHeader,
  Pager,
  SkeletonRows,
} from "../components/ui";
import TiltLink from "../components/Tilt";
import type { BookSummary, Category, Page } from "../api/types";

export default function Catalogue() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") ?? "1");
  const category = params.get("category") ?? "";
  const availableOnly = params.get("available") === "1";
  const [input, setInput] = useState(q);

  const cats = useApi<Category[]>("/categories");

  const query = new URLSearchParams({ page: String(page), page_size: "18" });
  if (q) query.set("q", q);
  if (category) query.set("category", category);
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
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <>
      <PageHeader
        title="Catalogue"
        sub="Browse and search the full collection"
        actions={
          <Link to="/ai-search" className="btn accent">
            ✦ AI Smart Search
          </Link>
        }
      />

      <div className="card card-pad stack-sm" style={{ marginBottom: 16 }}>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: input || null, page: "1" });
          }}
        >
          <input
            className="grow"
            placeholder="Title, author, ISBN, keyword…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <select
            style={{ maxWidth: 200 }}
            value={category}
            onChange={(e) => update({ category: e.target.value || null, page: "1" })}
          >
            <option value="">All categories</option>
            {(cats.data ?? []).map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="check" style={{ margin: 0, whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) =>
                update({ available: e.target.checked ? "1" : null, page: "1" })
              }
            />
            Available only
          </label>
          <button className="btn" type="submit">
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : error ? (
        <ErrorBox error={error} />
      ) : data && data.items.length ? (
        <>
          <div className="book-grid">
            {data.items.map((b) => (
              <TiltLink
                to={`/books/${b.id}`}
                key={b.id}
                className="card book-card"
              >
                <div className="cover">
                  {b.cover_image_url ? (
                    <img src={b.cover_image_url} alt="" />
                  ) : (
                    b.title[0]
                  )}
                </div>
                <h3>{b.title}</h3>
                <div className="by">
                  {b.author_names.join(", ") || "Unknown author"}
                </div>
                <div className="small muted">
                  {b.publication_year ?? ""} · {b.language}
                </div>
                <div className="foot">
                  <span
                    className={`badge ${b.available_copies ? "ok" : "danger"}`}
                  >
                    {b.available_copies}/{b.total_copies} available
                  </span>
                </div>
              </TiltLink>
            ))}
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <Pager
              page={page}
              pages={pages}
              total={data.total}
              onPage={(p) => update({ page: String(p) })}
            />
          </div>
        </>
      ) : (
        <Empty icon="▤">No books match your search.</Empty>
      )}
    </>
  );
}
