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
} from "../../components/ui";
import type { Reservation } from "../../api/types";

type Tab = "ready" | "pending" | "all";

export default function Reservations() {
  const [tab, setTab] = useState<Tab>("ready");
  const { push } = useToast();
  const filters = tab === "all" ? {} : { status: tab };
  const { data, loading, error, page, pages, setPage, reload } =
    usePagedQuery<Reservation>("/reservations", filters, 25);

  const cancel = useMutation((id: string) =>
    api(`/reservations/${id}`, { method: "DELETE" }),
  );

  return (
    <>
      <PageHeader
        title="Reservations"
        sub="Hold queue per title. Ready holds are waiting at the desk."
      />
      <Tabs
        active={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        tabs={[
          { id: "ready", label: "Ready for pickup" },
          { id: "pending", label: "In queue" },
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
                    <th>Book</th>
                    <th>Member</th>
                    <th>Placed</th>
                    <th>Queue</th>
                    <th>Hold until</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/books/${r.book_id}`}>{r.book.title}</Link>
                      </td>
                      <td className="muted small">{r.user_id.slice(0, 8)}</td>
                      <td>{fmtDate(r.created_at)}</td>
                      <td>{r.status === "pending" ? `#${r.queue_position}` : "—"}</td>
                      <td>{r.expires_at ? fmtDate(r.expires_at) : "—"}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        {(r.status === "pending" || r.status === "ready") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await cancel.run(r.id);
                              push("Reservation cancelled", "ok");
                              reload();
                            }}
                          >
                            Cancel
                          </Button>
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
          <Empty icon="⧗">No reservations in this view.</Empty>
        )}
      </div>
    </>
  );
}
