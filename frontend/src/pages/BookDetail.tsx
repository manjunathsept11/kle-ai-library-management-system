import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi, useMutation } from "../lib/useApi";
import { api } from "../api/client";
import { useToast } from "../theme";
import {
  AiBadge,
  Button,
  ErrorBox,
  Modal,
  PageHeader,
  SkeletonRows,
  StatusBadge,
  fmtDate,
} from "../components/ui";
import type { BookDetail as Book, Favorite, SearchResponse } from "../api/types";

export default function BookDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const staff = user?.role === "librarian" || user?.role === "admin";

  const { data, loading, error, reload } = useApi<Book>(`/books/${id}`);
  const favs = useApi<Favorite[]>("/me/favorites");
  const similar = useApi<SearchResponse>(
    data ? `/search?q=${encodeURIComponent(data.title)}&mode=semantic&limit=6` : null,
  );
  const [copyModal, setCopyModal] = useState(false);
  const [copies, setCopies] = useState(1);

  const isFav = favs.data?.some((f) => f.book.id === id);

  const toggleFav = useMutation(async () => {
    if (isFav) await api(`/me/favorites/${id}`, { method: "DELETE" });
    else await api(`/me/favorites/${id}`, { method: "PUT" });
  });
  const reserve = useMutation(() =>
    api("/reservations", { method: "POST", body: { book_id: id } }),
  );
  const addCopies = useMutation((n: number) =>
    api(`/books/${id}/copies`, { method: "POST", body: { count: n } }),
  );

  if (loading) return <SkeletonRows rows={8} />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  return (
    <>
      <Link to="/catalogue" className="muted small">
        ← Back to catalogue
      </Link>
      <PageHeader
        title={data.title}
        sub={data.subtitle ?? data.author_names.join(", ")}
        actions={
          <>
            <Button
              variant="secondary"
              loading={toggleFav.loading}
              onClick={async () => {
                await toggleFav.run();
                favs.reload();
                push(isFav ? "Removed from favorites" : "Added to favorites", "ok");
              }}
            >
              {isFav ? "★ Saved" : "☆ Save"}
            </Button>
            {data.available_copies > 0 ? (
              <span className="badge ok" style={{ alignSelf: "center" }}>
                {data.available_copies} available — borrow at the desk
              </span>
            ) : (
              <Button
                loading={reserve.loading}
                onClick={async () => {
                  const r = await reserve.run();
                  if (r !== undefined) push("Reservation placed — you're in the queue", "ok");
                  else push(reserve.error?.message ?? "Could not reserve", "err");
                }}
              >
                ⧗ Reserve
              </Button>
            )}
          </>
        }
      />

      <div className="grid cols-2">
        <div className="card card-pad">
          <div className="dl">
            <div>
              <div className="dt">Author(s)</div>
              <div className="dd">{data.author_names.join(", ") || "—"}</div>
            </div>
            <div>
              <div className="dt">ISBN</div>
              <div className="dd">{data.isbn ?? "—"}</div>
            </div>
            <div>
              <div className="dt">Publisher</div>
              <div className="dd">{data.publisher?.name ?? "—"}</div>
            </div>
            <div>
              <div className="dt">Edition</div>
              <div className="dd">{data.edition ?? "—"}</div>
            </div>
            <div>
              <div className="dt">Year</div>
              <div className="dd">{data.publication_year ?? "—"}</div>
            </div>
            <div>
              <div className="dt">Category</div>
              <div className="dd">{data.category?.name ?? "—"}</div>
            </div>
            <div>
              <div className="dt">Language</div>
              <div className="dd">{data.language}</div>
            </div>
            <div>
              <div className="dt">Availability</div>
              <div className="dd">
                {data.available_copies}/{data.total_copies}
              </div>
            </div>
          </div>
          {data.description && (
            <>
              <div className="dt" style={{ marginTop: 14 }}>
                Description
              </div>
              <p style={{ marginTop: 4 }}>{data.description}</p>
            </>
          )}
          {data.ai_tags && data.ai_tags.length > 0 && (
            <div style={{ marginTop: 8 }} className="row-tight wrap">
              <AiBadge label="tags" />
              {data.ai_tags.map((t) => (
                <span key={t} className="badge">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>
              Similar books <AiBadge />
            </h2>
          </div>
          <div className="card-body">
            {similar.loading ? (
              <SkeletonRows rows={3} />
            ) : (
              <div className="stack-sm">
                {(similar.data?.results ?? [])
                  .filter((r) => r.book.id !== data.id)
                  .slice(0, 5)
                  .map((r) => (
                    <Link
                      key={r.book.id}
                      to={`/books/${r.book.id}`}
                      className="spread"
                      style={{
                        padding: "8px 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <span>
                        <strong style={{ fontSize: 13 }}>{r.book.title}</strong>
                        <br />
                        <span className="muted small">
                          {r.book.author_names.join(", ")}
                        </span>
                      </span>
                      <span className="reason">{r.reason}</span>
                    </Link>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h2>Copies ({data.copies.length})</h2>
          {staff && (
            <Button size="sm" variant="secondary" onClick={() => setCopyModal(true)}>
              + Add copies
            </Button>
          )}
        </div>
        <div className="table-wrap">
          <table className="data">
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
        </div>
      </div>

      {copyModal && (
        <Modal
          title="Add copies"
          onClose={() => setCopyModal(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCopyModal(false)}>
                Cancel
              </Button>
              <Button
                loading={addCopies.loading}
                onClick={async () => {
                  const r = await addCopies.run(copies);
                  if (r !== undefined) {
                    push(`${copies} copy/copies added`, "ok");
                    setCopyModal(false);
                    reload();
                  } else push("Could not add copies", "err");
                }}
              >
                Add
              </Button>
            </>
          }
        >
          <label>Number of copies</label>
          <input
            type="number"
            min={1}
            max={50}
            value={copies}
            onChange={(e) => setCopies(Number(e.target.value))}
          />
        </Modal>
      )}
    </>
  );
}
