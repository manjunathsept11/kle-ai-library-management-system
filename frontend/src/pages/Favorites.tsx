import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useApi } from "../lib/useApi";
import { useToast } from "../theme";
import {
  Button,
  Empty,
  PageHeader,
  SkeletonRows,
} from "../components/ui";
import type { Favorite } from "../api/types";

export default function Favorites() {
  const { data, loading, reload } = useApi<Favorite[]>("/me/favorites");
  const { push } = useToast();

  return (
    <>
      <PageHeader title="Favorites" sub="Books you've saved for later" />
      {loading ? (
        <SkeletonRows rows={4} />
      ) : data && data.length ? (
        <div className="book-grid">
          {data.map((f) => (
            <div key={f.book.id} className="card book-card">
              <Link to={`/books/${f.book.id}`}>
                <div className="cover" style={{ maxHeight: 90 }}>
                  {f.book.title[0]}
                </div>
              </Link>
              <Link to={`/books/${f.book.id}`}>
                <h3>{f.book.title}</h3>
              </Link>
              <div className="by">{f.book.author_names.join(", ")}</div>
              <div className="foot">
                <span
                  className={`badge ${f.book.available_copies ? "ok" : "danger"}`}
                >
                  {f.book.available_copies ? "Available" : "On loan"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await api(`/me/favorites/${f.book.id}`, { method: "DELETE" });
                    push("Removed", "ok");
                    reload();
                  }}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="★">
          No favorites yet. Tap “☆ Save” on any book to add it here.
        </Empty>
      )}
    </>
  );
}
