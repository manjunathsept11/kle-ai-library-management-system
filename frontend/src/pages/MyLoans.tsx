import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useApi, useMutation } from "../lib/useApi";
import {
  Empty,
  ErrorBox,
  Loading,
  StatusBadge,
  Toast,
  fmtDate,
} from "../components/ui";
import type { Loan, Page } from "../api/types";

export default function MyLoans() {
  const { data, loading, error, reload } =
    useApi<Page<Loan>>("/me/loans?page_size=100");
  const [toast, setToast] = useState<{ m: string; t: "ok" | "err" } | null>(
    null,
  );

  const renew = useMutation((loanId: string) =>
    api<Loan>(`/loans/${loanId}/renew`, { method: "POST" }),
  );

  const active = data?.items.filter(
    (l) => l.status === "active" || l.status === "overdue",
  );
  const past = data?.items.filter(
    (l) => l.status === "returned" || l.status === "lost",
  );

  return (
    <div className="stack">
      <h1>My loans</h1>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} />
      ) : (
        <>
          <div className="card">
            <h2>Current</h2>
            {active && active.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th>Renewed</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link to={`/books/${l.book_id}`}>{l.book.title}</Link>
                      </td>
                      <td>{fmtDate(l.issued_at)}</td>
                      <td>{fmtDate(l.due_at)}</td>
                      <td>{l.renewed_count}×</td>
                      <td>
                        <StatusBadge status={l.status} />
                      </td>
                      <td>
                        <button
                          className="secondary"
                          disabled={renew.loading}
                          onClick={async () => {
                            const r = await renew.run(l.id);
                            if (r) {
                              setToast({
                                m: `Renewed to ${fmtDate(r.due_at)}`,
                                t: "ok",
                              });
                              reload();
                            } else {
                              setToast({
                                m: renew.error?.message ?? "Could not renew",
                                t: "err",
                              });
                            }
                          }}
                        >
                          Renew
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No books on loan.</Empty>
            )}
          </div>

          <div className="card">
            <h2>History</h2>
            {past && past.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Issued</th>
                    <th>Returned</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((l) => (
                    <tr key={l.id}>
                      <td>{l.book.title}</td>
                      <td>{fmtDate(l.issued_at)}</td>
                      <td>{fmtDate(l.returned_at)}</td>
                      <td>
                        <StatusBadge status={l.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No past loans yet.</Empty>
            )}
          </div>
        </>
      )}

      {toast && <Toast message={toast.m} tone={toast.t} />}
    </div>
  );
}
