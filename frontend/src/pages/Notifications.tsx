import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useApi } from "../lib/useApi";
import {
  Button,
  Empty,
  PageHeader,
  SkeletonRows,
  fmtDateTime,
} from "../components/ui";
import type { NotificationList } from "../api/types";

const ICON: Record<string, string> = {
  due_reminder: "◔",
  overdue: "!",
  reservation_ready: "⧗",
  reservation_expired: "⧗",
  fine_issued: "₹",
  new_book: "▤",
  recommendation: "✦",
  announcement: "📢",
};

export default function Notifications() {
  const { data, loading, reload } = useApi<NotificationList>(
    "/me/notifications",
  );
  const nav = useNavigate();

  return (
    <>
      <PageHeader
        title="Notifications"
        sub={data ? `${data.unread} unread` : ""}
        actions={
          !!data?.unread && (
            <Button
              variant="secondary"
              onClick={async () => {
                await api("/me/notifications/read-all", { method: "POST" });
                reload();
              }}
            >
              Mark all read
            </Button>
          )
        }
      />
      {loading ? (
        <SkeletonRows rows={5} />
      ) : data && data.items.length ? (
        <div className="card">
          {data.items.map((n) => (
            <button
              key={n.id}
              onClick={async () => {
                if (!n.is_read)
                  await api(`/me/notifications/${n.id}/read`, {
                    method: "POST",
                  });
                reload();
                if (n.link) nav(n.link);
              }}
              style={{
                display: "flex",
                gap: 12,
                width: "100%",
                textAlign: "left",
                background: n.is_read ? "transparent" : "var(--surface-2)",
                border: "none",
                borderBottom: "1px solid var(--border)",
                padding: "14px 16px",
                cursor: "pointer",
                color: "var(--text)",
              }}
            >
              <span style={{ fontSize: 16 }}>{ICON[n.type] ?? "•"}</span>
              <span className="grow">
                <div style={{ fontWeight: n.is_read ? 500 : 700 }}>
                  {n.title}
                </div>
                {n.body && (
                  <div className="muted small">{n.body}</div>
                )}
                <div className="muted" style={{ fontSize: 11 }}>
                  {fmtDateTime(n.created_at)}
                </div>
              </span>
              {!n.is_read && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--primary)",
                    marginTop: 6,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      ) : (
        <Empty icon="◔">You have no notifications.</Empty>
      )}
    </>
  );
}
