import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/useApi";
import { AiBadge, Empty, ErrorBox, Loading, StatusBadge, fmtDate } from "../components/ui";
import type { BorrowingStatus, Loan, Page, SearchResponse } from "../api/types";

function MemberDashboard() {
  const status = useApi<BorrowingStatus>("/me/borrowing-status");
  const loans = useApi<Page<Loan>>("/me/loans?active_only=true&page_size=50");
  // Lightweight "recommended" via semantic search on a broad interest term.
  const reco = useApi<SearchResponse>(
    "/search?q=popular computer science and programming books&mode=hybrid&limit=4",
  );

  return (
    <div className="stack">
      <h1>Your library</h1>

      {status.loading ? (
        <Loading />
      ) : status.error ? (
        <ErrorBox error={status.error} />
      ) : (
        status.data && (
          <div className="stat-grid">
            <div className="card stat">
              <div className="n">{status.data.active_loans}</div>
              <div className="l">Books on loan</div>
            </div>
            <div className="card stat">
              <div className="n">{status.data.borrow_limit}</div>
              <div className="l">Borrowing limit</div>
            </div>
            <div className="card stat">
              <div className="n">₹{status.data.outstanding_fines.toFixed(2)}</div>
              <div className="l">Outstanding fines</div>
            </div>
            <div className="card stat">
              <div className="n">{status.data.can_borrow ? "Yes" : "No"}</div>
              <div className="l">Can borrow now</div>
            </div>
          </div>
        )
      )}

      <div className="card">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Due soon</h2>
          <Link to="/my-loans">View all loans →</Link>
        </div>
        {loans.loading ? (
          <Loading />
        ) : loans.data && loans.data.items.length ? (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loans.data.items.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/books/${l.book_id}`}>{l.book.title}</Link>
                  </td>
                  <td>{fmtDate(l.due_at)}</td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No books on loan right now.</Empty>
        )}
      </div>

      <div className="card">
        <div className="spread">
          <h2 style={{ margin: 0 }}>
            Recommended for you <AiBadge />
          </h2>
          <Link to="/ai-search">Try AI Smart Search →</Link>
        </div>
        {reco.loading ? (
          <Loading />
        ) : reco.data && reco.data.results.length ? (
          <div className="book-grid" style={{ marginTop: 10 }}>
            {reco.data.results.map((r) => (
              <Link
                to={`/books/${r.book.id}`}
                key={r.book.id}
                className="card book-card"
              >
                <h3>{r.book.title}</h3>
                <div className="authors">{r.book.author_names.join(", ")}</div>
                <div className="foot">
                  <span className="badge">{r.book.available_copies} avail.</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty>No recommendations yet.</Empty>
        )}
      </div>
    </div>
  );
}

function StaffDashboard() {
  const overdue = useApi<Page<Loan>>("/loans?active_only=true&page_size=100");
  const books = useApi<Page<{ id: string }>>("/books?page_size=1");

  const overdueCount =
    overdue.data?.items.filter((l) => l.status === "overdue").length ?? 0;
  const activeCount = overdue.data?.items.length ?? 0;

  return (
    <div className="stack">
      <h1>Librarian dashboard</h1>
      <div className="stat-grid">
        <div className="card stat">
          <div className="n">{books.data?.total ?? "…"}</div>
          <div className="l">Catalogue titles</div>
        </div>
        <div className="card stat">
          <div className="n">{activeCount}</div>
          <div className="l">Active loans</div>
        </div>
        <div className="card stat">
          <div className="n">{overdueCount}</div>
          <div className="l">Overdue</div>
        </div>
      </div>

      <div className="card">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Recent / overdue loans</h2>
          <Link to="/staff/circulation">Issue / Return →</Link>
        </div>
        {overdue.loading ? (
          <Loading />
        ) : overdue.data && overdue.data.items.length ? (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {overdue.data.items.slice(0, 15).map((l) => (
                <tr key={l.id}>
                  <td>{l.book.title}</td>
                  <td>{fmtDate(l.due_at)}</td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No active loans.</Empty>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const staff = user?.role === "librarian" || user?.role === "admin";
  return staff ? <StaffDashboard /> : <MemberDashboard />;
}
