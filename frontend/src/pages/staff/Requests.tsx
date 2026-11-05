import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useMutation } from "../../lib/useApi";
import { confetti } from "../../lib/fx";
import { usePagedQuery } from "../../lib/usePagedQuery";
import { useToast } from "../../theme";
import {
  Button,
  Empty,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Pager,
  SkeletonRows,
  StatusBadge,
  Tabs,
  fmtDate,
} from "../../components/ui";
import type { BorrowRequest } from "../../api/types";

type Tab = "pending" | "approved" | "rejected" | "all";

export default function Requests() {
  const [tab, setTab] = useState<Tab>("pending");
  const { push } = useToast();
  const filters = tab === "all" ? {} : { status: tab };
  const { data, loading, error, page, pages, setPage, reload } =
    usePagedQuery<BorrowRequest>("/borrow-requests", filters, 25);

  const [rejecting, setRejecting] = useState<BorrowRequest | null>(null);
  const [reason, setReason] = useState("");

  const approve = useMutation((id: string) =>
    api(`/borrow-requests/${id}/approve`, { method: "POST" }),
  );
  const reject = useMutation((id: string) =>
    api(`/borrow-requests/${id}/reject`, { method: "POST", body: { reason } }),
  );

  return (
    <>
      <PageHeader
        title="Borrow approvals"
        sub="Members request available books; approve to issue the loan, or decline with a reason."
      />
      <Tabs
        active={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        tabs={[
          { id: "pending", label: "Awaiting decision" },
          { id: "approved", label: "Approved" },
          { id: "rejected", label: "Declined" },
          { id: "all", label: "All" },
        ]}
      />
      <div className="card">
        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorBox error={error} />
        ) : data && data.items.length ? (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Book</th>
                    <th>Requested</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.member_name ?? "—"}
                        {r.member_identifier && (
                          <span className="muted small"> · {r.member_identifier}</span>
                        )}
                      </td>
                      <td>
                        <Link to={`/books/${r.book_id}`}>{r.book.title}</Link>
                        {r.note && <div className="muted small">“{r.note}”</div>}
                      </td>
                      <td>{fmtDate(r.created_at)}</td>
                      <td>
                        <StatusBadge status={r.status} />
                        {r.decision_note && (
                          <div className="muted small">{r.decision_note}</div>
                        )}
                      </td>
                      <td>
                        {r.status === "pending" && (
                          <div className="row-tight">
                            <Button
                              size="sm"
                              loading={approve.loading}
                              onClick={async () => {
                                const ok = await approve.run(r.id);
                                if (ok !== undefined) {
                                  confetti(0.5, 0.5);
                                  push(`Approved — “${r.book.title}” issued`, "ok");
                                } else
                                  push(approve.error?.message ?? "Could not approve", "err");
                                reload();
                              }}
                            >
                              ✓ Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRejecting(r);
                                setReason("");
                              }}
                            >
                              Decline
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} total={data.total} onPage={setPage} />
          </>
        ) : (
          <Empty icon="✋">
            {tab === "pending" ? "No requests waiting — all caught up." : "Nothing in this view."}
          </Empty>
        )}
      </div>

      {rejecting && (
        <Modal
          title={`Decline · ${rejecting.book.title}`}
          onClose={() => setRejecting(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={reject.loading}
                onClick={async () => {
                  const ok = await reject.run(rejecting.id);
                  if (ok !== undefined) {
                    push("Request declined", "ok");
                    setRejecting(null);
                    reload();
                  } else push(reject.error?.message ?? "Failed", "err");
                }}
              >
                Decline request
              </Button>
            </>
          }
        >
          <Field label="Reason (shown to the member)">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Reference copy — please read it in the library"
            />
          </Field>
        </Modal>
      )}
    </>
  );
}
