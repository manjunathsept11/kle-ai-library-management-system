import type { ReactNode } from "react";
import { RequestError } from "../api/client";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="loading">{label}</div>;
}

export function ErrorBox({ error }: { error: RequestError | Error | string }) {
  const msg =
    typeof error === "string"
      ? error
      : error instanceof RequestError
        ? error.message
        : error.message;
  return <div className="error-box">{msg}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Marks content that was produced or ranked by AI. */
export function AiBadge({ label = "AI" }: { label?: string }) {
  return (
    <span className="badge ai" title="Generated or ranked by AI">
      ✦ {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "overdue" || status === "lost"
      ? "danger"
      : status === "available" || status === "active" || status === "returned"
        ? "ok"
        : "warn";
  return <span className={`badge ${tone}`}>{status}</span>;
}

export function Toast({
  message,
  tone = "ok",
}: {
  message: string;
  tone?: "ok" | "err";
}) {
  return <div className={`toast ${tone === "err" ? "err" : ""}`}>{message}</div>;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
