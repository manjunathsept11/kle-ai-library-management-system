import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useMutation } from "../lib/useApi";
import { AiBadge, Empty, ErrorBox } from "../components/ui";
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
      body: { query: q, mode: m, limit: 20 },
    }),
  );

  async function run(q: string) {
    if (!q.trim()) return;
    setQuery(q);
    const r = await search.run(q, mode);
    if (r) setResult(r);
  }

  return (
    <div className="stack">
      <div>
        <h1>
          AI Smart Search <AiBadge />
        </h1>
        <p className="muted">
          Ask in plain language. Semantic search understands intent; keyword
          search still works if AI is unavailable.
        </p>
      </div>

      <form
        className="card stack"
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
        <div className="spread">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ margin: 0 }}>Mode</label>
            <select
              style={{ width: "auto" }}
              value={mode}
              onChange={(e) => setMode(e.target.value as SearchMode)}
            >
              <option value="hybrid">Hybrid (keyword + AI)</option>
              <option value="semantic">AI semantic only</option>
              <option value="keyword">Keyword only</option>
            </select>
          </div>
          <button type="submit" disabled={search.loading}>
            {search.loading ? "Searching…" : "Search"}
          </button>
        </div>
        <div className="suggested">
          {EXAMPLES.map((ex) => (
            <button type="button" key={ex} onClick={() => run(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </form>

      {search.error && <ErrorBox error={search.error} />}

      {result && (
        <div className="stack">
          <div className="spread">
            <p className="muted">
              {result.count} result(s) for “{result.query}”
            </p>
            {result.ai_used ? (
              <AiBadge label="AI ranked" />
            ) : (
              <span className="badge warn">Keyword results</span>
            )}
          </div>
          {result.note && <div className="error-box">{result.note}</div>}

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
                  <h3>{r.book.title}</h3>
                  <div className="authors">
                    {r.book.author_names.join(", ")}
                  </div>
                  <span className="reason">{r.reason}</span>
                  <div className="foot">
                    <span
                      className={`badge ${
                        r.book.available_copies ? "ok" : "danger"
                      }`}
                    >
                      {r.book.available_copies}/{r.book.total_copies} avail.
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      score {r.score.toFixed(2)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
