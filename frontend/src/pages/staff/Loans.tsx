import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useMutation } from "../../lib/useApi";
import { usePagedQuery } from "../../lib/usePagedQuery";
import { useToast } from "../../theme";
import {
  Button,
  Empty,
  ErrorBox,
  PageHeader,
  Pager,
  SkeletonRows,
  StatusBadge,
  Tabs,
  fmtDate,
  relativeDue,
} from "../../components/ui";
import type { Loan } from "../../api/types";

type Tab = "active" | "overdue" | "returned" | "all";

export default function Loans() {
  const [tab, setTab] = useState<Tab>("active");
  const [q, setQ] = useState("");
  const { push } = useToast();

  const filters: Record<string, string | boolean> = { q };
  if (tab === "active") filters.active_only = true;
  if (tab === "overdue") filters.status = "overdue";
  if (tab === "returned") filters.returned = true;

  const { data, loading, error, page, pages, setPage, reload } =
    usePagedQuery<Loan>("/loans", filters, 25);

  const returnLoan = useMutation((id: string) =>
    api<{ message: string; fine: unknown }>("/returns", {
      method: "POST",
      body: { loan_id: id },
    }),
  );
  const renew = useMutation((id: string) =>
    api(`/loans/${id}/renew`, { method: "POST" }),
  );

  return (
    <>
      <PageHeader
        title="Loans & Returns"
        sub="Every issue and return across the library"
      />

      <Tabs
        active={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        tabs={[
          { id: "active", label: "On loan" },
          { id: "overdue", label: "Overdue" },
          { id: "returned", label: "Returned" },
          { id: "all", label: "All" },
        ]}
      />

      <div className="card">
        <div className="card-head">
          <input
            placeholder="Filter by book title…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 280 }}
          />
        </div>
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
                    <th>Book</th>
                    <th>Member</th>
                    <th>Issued</th>
                    <th>{tab === "returned" ? "Returned" : "Due"}</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link to={`/books/${l.book_id}`}>{l.book.title}</Link>
                      </td>
                      <td>
                        {l.member_name}
                        {l.member_identifier && (
                          <span className="muted small">
                            {" "}
                            · {l.member_identifier}
                          </span>
                        )}
                      </td>
                      <td>{fmtDate(l.issued_at)}</td>
                      <td>
                        {tab === "returned"
                          ? fmtDate(l.returned_at)
                          : (() => {
                              const d = relativeDue(l.due_at);
                              return (
                                <>
                                  {fmtDate(l.due_at)}{" "}
                                  <span className={`badge ${d.tone}`}>
                                    {d.text}
                                  </span>
                                </>
                              );
                            })()}
                      </td>
                      <td>
                        <StatusBadge status={l.status} />
                      </td>
                      <td>
                        {(l.status === "active" || l.status === "overdue") && (
                          <div className="row-tight">
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={renew.loading}
                              onClick={async () => {
                                const r = await renew.run(l.id);
                                if (r !== undefined) {
                                  push("Renewed", "ok");
                                  reload();
                                } else
                                  push(renew.error?.message ?? "Cannot renew", "err");
                              }}
                            >
                              Renew
                            </Button>
                            <Button
                              size="sm"
                              loading={returnLoan.loading}
                              onClick={async () => {
                                const r = await returnLoan.run(l.id);
                                if (r) {
                                  push(r.message, r.fine ? "err" : "ok");
                                  reload();
                                }
                              }}
                            >
                              Return
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              pages={pages}
              total={data.total}
              onPage={setPage}
            />
          </>
        ) : (
          <Empty icon="⟳">No loans in this view.</Empty>
        )}
      </div>
    </>
  );
}
