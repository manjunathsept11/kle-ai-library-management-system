import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useMutation } from "../lib/useApi";
import { AiBadge, Button, Empty, ErrorBox, PageHeader } from "../components/ui";
import type { SearchMode, SearchResponse } from "../api/types";

const EXAMPLES = [
  "beginner-friendly books on machine learning",
  "cybersecurity books about web attacks",
  "learning database management systems",
  "cloud computing and AWS",
];

export default function AiSearch() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const search = useMutation((q: string, m: SearchMode) =>
    api<SearchResponse>("/search", {
      method: "POST",
      body: { query: q, mode: m, limit: 24 },
    }),
  );

  async function run(q: string) {
    if (!q.trim()) return;
    setQuery(q);
    const r = await search.run(q, mode);
    if (r) setResult(r);
  }

  return (
    <>
      <PageHeader
        title={
          <>
            AI Smart Search <AiBadge />
          </>
        }
        sub="Ask in plain language. Semantic search understands intent; keyword search still works if AI is unavailable."
      />

      <div className="card card-pad stack" style={{ marginBottom: 16 }}>
        <form
          className="stack-sm"
          onSubmit={(e) => {
            e.preventDefault();
            run(query);
          }}
        >
          <textarea
            rows={2}
            placeholder="e.g. I need beginner books on artificial intelligence and machine learning"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="spread wrap">
            <div className="segmented">
              {(["hybrid", "semantic", "keyword"] as SearchMode[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  className={m === mode ? "active" : ""}
                  onClick={() => setMode(m)}
                >
                  {m === "hybrid"
                    ? "Hybrid"
                    : m === "semantic"
                      ? "AI semantic"
                      : "Keyword"}
                </button>
              ))}
            </div>
            <Button type="submit" loading={search.loading}>
              Search
            </Button>
          </div>
          <div className="chip-row">
            {EXAMPLES.map((ex) => (
              <button
                type="button"
                key={ex}
                className="chip"
                onClick={() => run(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        </form>
      </div>

      {search.error && <ErrorBox error={search.error} />}

      {result && (
        <div className="stack">
          <div className="spread">
            <p className="muted small" style={{ margin: 0 }}>
              {result.count} result(s) for “{result.query}”
            </p>
            {result.ai_used ? (
              <AiBadge label="AI ranked" />
            ) : (
              <span className="badge warn">Keyword results</span>
            )}
          </div>
          {result.note && <div className="callout warn">{result.note}</div>}

          {result.results.length === 0 ? (
            <Empty>Nothing matched. Try different wording.</Empty>
          ) : (
            <div className="book-grid">
              {result.results.map((r) => (
                <Link
                  to={`/books/${r.book.id}`}
                  key={r.book.id}
                  className="card book-card"
                >
                  <div className="cover" style={{ maxHeight: 84 }}>
                    {r.book.title[0]}
                  </div>
                  <h3>{r.book.title}</h3>
                  <div className="by">{r.book.author_names.join(", ")}</div>
                  <span className="reason">{r.reason}</span>
                  <div className="foot">
                    <span
                      className={`badge ${r.book.available_copies ? "ok" : "danger"}`}
                    >
                      {r.book.available_copies}/{r.book.total_copies}
                    </span>
                    <span className="muted small">
                      {r.score.toFixed(2)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
