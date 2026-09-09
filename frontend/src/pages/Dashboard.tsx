import { Link } from "react-router-dom";
import { useApi } from "../lib/useApi";
import {
  AiBadge,
  Empty,
  ErrorBox,
  PageHeader,
  SkeletonRows,
  Stat,
  StatusBadge,
  fmtDate,
  money,
} from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import type { DashboardData, SearchResponse } from "../api/types";

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useApi<DashboardData>("/dashboard");

  if (loading) return <SkeletonRows rows={7} />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const greeting = new Date().getHours() < 12 ? "Good morning" : "Good afternoon";

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user?.full_name?.split(" ")[0]}`}
        sub={
          data.role === "admin"
            ? "System overview"
            : data.role === "librarian"
              ? "Library operations at a glance"
              : "Your library activity"
        }
      />
      {data.role === "student" || data.role === "faculty" ? (
        <MemberView data={data} />
      ) : (
        <StaffView data={data} admin={data.role === "admin"} />
      )}
    </>
  );
}

function MemberView({ data }: { data: DashboardData }) {
  const reco = useApi<SearchResponse>(
    "/search?q=recommended computer science and programming&mode=hybrid&limit=4",
  );
  return (
    <div className="stack">
      <div className="grid cols-4">
        <Stat label="Books on loan" value={data.active_loans ?? 0} icon="▦" />
        <Stat
          label="Borrowing limit"
          value={data.borrow_limit ?? 0}
          icon="▤"
        />
        <Stat
          label="Outstanding fines"
          value={money(data.outstanding_fines ?? 0)}
          icon="₹"
          tone={data.outstanding_fines ? "down" : undefined}
        />
        <Stat
          label="Active reservations"
          value={data.reservations_active ?? 0}
          icon="⧗"
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Due soon</h2>
          <Link to="/my-library">My Library →</Link>
        </div>
        {data.due_soon && data.due_soon.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.due_soon.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link to={`/books/${l.book_id}`}>{l.title}</Link>
                    </td>
                    <td>{fmtDate(l.due_at)}</td>
                    <td>
                      <StatusBadge status={l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="✓">Nothing due — you're all caught up.</Empty>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            Recommended for you <AiBadge />
          </h2>
          <Link to="/ai-search">AI Smart Search →</Link>
        </div>
        <div className="card-body">
          {reco.loading ? (
            <SkeletonRows rows={2} />
          ) : reco.data && reco.data.results.length ? (
            <div className="book-grid">
              {reco.data.results.map((r) => (
                <Link
                  to={`/books/${r.book.id}`}
                  key={r.book.id}
                  className="card book-card"
                >
                  <div className="cover" style={{ maxHeight: 90 }}>
                    {r.book.title[0]}
                  </div>
                  <h3>{r.book.title}</h3>
                  <div className="by">{r.book.author_names.join(", ")}</div>
                  <div className="foot">
                    <span
                      className={`badge ${r.book.available_copies ? "ok" : "danger"}`}
                    >
                      {r.book.available_copies ? "Available" : "On loan"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>No recommendations yet.</Empty>
          )}
        </div>
      </div>
    </div>
  );
}

function StaffView({ data, admin }: { data: DashboardData; admin: boolean }) {
  return (
    <div className="stack">
      <div className="grid cols-4">
        <Stat label="Catalogue titles" value={data.total_titles ?? 0} icon="▤" />
        <Stat label="Total copies" value={data.total_copies ?? 0} icon="▣" />
        <Stat
          label="On loan"
          value={data.active_loans ?? 0}
          icon="▦"
        />
        <Stat
          label="Overdue"
          value={data.overdue_loans ?? 0}
          icon="!"
          tone={data.overdue_loans ? "down" : undefined}
        />
        <Stat
          label="Reservations ready"
          value={data.reservations_ready ?? 0}
          icon="⧗"
        />
        <Stat
          label="In queue"
          value={data.reservations_pending ?? 0}
          icon="⋯"
        />
        <Stat
          label="Unpaid fines"
          value={money(data.unpaid_fines_total ?? 0)}
          icon="₹"
        />
        <Stat
          label="Issued (7d)"
          value={data.issued_last_7d ?? 0}
          icon="↗"
        />
      </div>

      {admin && (
        <div className="grid cols-4">
          <Stat label="Total users" value={data.total_users ?? 0} icon="◈" />
          <Stat label="Logins (24h)" value={data.logins_24h ?? 0} icon="→" />
          <Stat
            label="Searches (7d)"
            value={data.searches_last_7d ?? 0}
            icon="✦"
          />
          <Stat
            label="Suspended"
            value={data.suspended_users ?? 0}
            icon="⊘"
          />
        </div>
      )}

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <h2>Most borrowed</h2>
            <Link to="/staff/loans">Loans →</Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <tbody>
                {(data.popular_books ?? []).map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link to={`/books/${b.id}`}>{b.title}</Link>
                    </td>
                    <td className="num">{b.loans}</td>
                  </tr>
                ))}
                {!data.popular_books?.length && (
                  <tr>
                    <td className="muted">No circulation yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>{admin ? "Loans by category" : "Quick actions"}</h2>
          </div>
          <div className="card-body">
            {admin ? (
              <div className="stack-sm">
                {(data.loans_by_category ?? []).map((c) => {
                  const max = Math.max(
                    ...(data.loans_by_category ?? [{ loans: 1 }]).map(
                      (x) => x.loans,
                    ),
                  );
                  return (
                    <div key={c.category}>
                      <div className="spread small">
                        <span>{c.category}</span>
                        <span className="muted">{c.loans}</span>
                      </div>
                      <div className="meter">
                        <span style={{ width: `${(c.loans / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="row">
                <Link to="/staff/circulation" className="btn">
                  ⇄ Issue / Return
                </Link>
                <Link to="/staff/books" className="btn secondary">
                  + Add a book
                </Link>
                <Link to="/staff/reservations" className="btn secondary">
                  ⧗ Reservation queue
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
