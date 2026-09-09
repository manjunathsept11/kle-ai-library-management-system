import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useApi, useMutation } from "../lib/useApi";
import { useToast } from "../theme";
import {
  Button,
  Empty,
  ErrorBox,
  PageHeader,
  SkeletonRows,
  Stat,
  StatusBadge,
  Tabs,
  fmtDate,
  money,
  relativeDue,
} from "../components/ui";
import type {
  BorrowingStatus,
  Fine,
  Loan,
  Page,
  Reservation,
} from "../api/types";

type Tab = "current" | "reservations" | "fines" | "history";

export default function MyLibrary() {
  const [tab, setTab] = useState<Tab>("current");
  const { push } = useToast();
  const status = useApi<BorrowingStatus>("/me/borrowing-status");
  const loans = useApi<Page<Loan>>("/me/loans?page_size=100");
  const reservations = useApi<Reservation[]>("/me/reservations");
  const fines = useApi<Fine[]>("/me/fines");

  const active = loans.data?.items.filter(
    (l) => l.status === "active" || l.status === "overdue",
  );
  const history = loans.data?.items.filter(
    (l) => l.status === "returned" || l.status === "lost",
  );
  const activeRes = reservations.data?.filter(
    (r) => r.status === "pending" || r.status === "ready",
  );
  const unpaid = fines.data?.filter(
    (f) => f.status === "unpaid" || f.status === "partial",
  );

  const renew = useMutation((id: string) =>
    api(`/loans/${id}/renew`, { method: "POST" }),
  );
  const cancelRes = useMutation((id: string) =>
    api(`/reservations/${id}`, { method: "DELETE" }),
  );

  return (
    <>
      <PageHeader title="My Library" sub="Loans, reservations, fines and history" />

      {status.data && (
        <div className="grid cols-4" style={{ marginBottom: 16 }}>
          <Stat
            label="On loan"
            value={`${status.data.active_loans}/${status.data.borrow_limit}`}
            icon="▦"
          />
          <Stat
            label="Reservations"
            value={activeRes?.length ?? 0}
            icon="⧗"
          />
          <Stat
            label="Outstanding fines"
            value={money(status.data.outstanding_fines)}
            icon="₹"
            tone={status.data.outstanding_fines ? "down" : undefined}
          />
          <Stat
            label="Can borrow"
            value={status.data.can_borrow ? "Yes" : "Blocked"}
            icon={status.data.can_borrow ? "✓" : "⊘"}
          />
        </div>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "current", label: "Current", count: active?.length },
          {
            id: "reservations",
            label: "Reservations",
            count: activeRes?.length,
          },
          { id: "fines", label: "Fines", count: unpaid?.length },
          { id: "history", label: "History", count: history?.length },
        ]}
      />

      {tab === "current" && (
        <div className="card">
          {loans.loading ? (
            <SkeletonRows />
          ) : loans.error ? (
            <ErrorBox error={loans.error} />
          ) : active && active.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th>Renewed</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((l) => {
                    const d = relativeDue(l.due_at);
                    return (
                      <tr key={l.id}>
                        <td>
                          <Link to={`/books/${l.book_id}`}>{l.book.title}</Link>
                        </td>
                        <td>{fmtDate(l.issued_at)}</td>
                        <td>
                          {fmtDate(l.due_at)}{" "}
                          <span className={`badge ${d.tone}`}>{d.text}</span>
                        </td>
                        <td>{l.renewed_count}×</td>
                        <td>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={renew.loading}
                            onClick={async () => {
                              const r = await renew.run(l.id);
                              if (r !== undefined) {
                                push("Renewed", "ok");
                                loans.reload();
                              } else
                                push(
                                  renew.error?.message ?? "Cannot renew",
                                  "err",
                                );
                            }}
                          >
                            Renew
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="✓">No books on loan.</Empty>
          )}
        </div>
      )}

      {tab === "reservations" && (
        <div className="card">
          {reservations.loading ? (
            <SkeletonRows />
          ) : activeRes && activeRes.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Queue</th>
                    <th>Hold until</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activeRes.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/books/${r.book_id}`}>{r.book.title}</Link>
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        {r.status === "pending" ? `#${r.queue_position}` : "—"}
                      </td>
                      <td>{r.expires_at ? fmtDate(r.expires_at) : "—"}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await cancelRes.run(r.id);
                            reservations.reload();
                            push("Reservation cancelled", "ok");
                          }}
                        >
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="⧗">
              No active reservations. Reserve a book from its detail page when no
              copy is available.
            </Empty>
          )}
        </div>
      )}

      {tab === "fines" && (
        <div className="card">
          {fines.loading ? (
            <SkeletonRows />
          ) : fines.data && fines.data.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Date</th>
                    <th className="num">Amount</th>
                    <th className="num">Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.data.map((f) => (
                    <tr key={f.id}>
                      <td style={{ textTransform: "capitalize" }}>{f.type}</td>
                      <td className="muted small">{f.reason ?? "—"}</td>
                      <td>{fmtDate(f.created_at)}</td>
                      <td className="num">{money(f.amount)}</td>
                      <td className="num">{money(f.paid_amount)}</td>
                      <td>
                        <StatusBadge status={f.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="✓">No fines. Keep it up!</Empty>
          )}
          {unpaid && unpaid.length > 0 && (
            <div className="callout" style={{ margin: 16 }}>
              Pay outstanding fines at the circulation desk. Staff can accept
              cash or record other payment methods.
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="card">
          {history && history.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Issued</th>
                    <th>Returned</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((l) => (
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
            </div>
          ) : (
            <Empty>No past loans yet.</Empty>
          )}
        </div>
      )}
    </>
  );
}
