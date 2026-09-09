import { useState } from "react";
import { usePagedQuery } from "../../lib/usePagedQuery";
import {
  Empty,
  ErrorBox,
  PageHeader,
  Pager,
  SkeletonRows,
  fmtDateTime,
} from "../../components/ui";
import type { AuditEntry } from "../../api/types";

export default function Audit() {
  const [action, setAction] = useState("");
  const { data, loading, error, page, pages, setPage } =
    usePagedQuery<AuditEntry>("/admin/audit", { action }, 40);

  return (
    <>
      <PageHeader
        title="Audit Log"
        sub="Every security-relevant and data-changing action"
      />
      <div className="card">
        <div className="card-head">
          <input
            placeholder="Filter by action prefix, e.g. loan. or admin."
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 320 }}
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
                    <th>When</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Summary</th>
                    <th>Request</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr key={e.id}>
                      <td className="muted small nowrap">
                        {fmtDateTime(e.created_at)}
                      </td>
                      <td>
                        <code>{e.action}</code>
                      </td>
                      <td className="muted small">
                        {e.entity_type}
                        {e.entity_id ? `/${e.entity_id.slice(0, 8)}` : ""}
                      </td>
                      <td>{e.summary ?? "—"}</td>
                      <td className="muted small">
                        {e.request_id?.slice(0, 8) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} total={data.total} onPage={setPage} />
          </>
        ) : (
          <Empty icon="☰">No audit entries.</Empty>
        )}
      </div>
    </>
  );
}
