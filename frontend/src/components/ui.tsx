import {
  useEffect,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { RequestError } from "../api/client";

/* ---------------------------------------------------------------- states */

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state">
      <div className="ic">◔</div>
      {label}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="stack-sm card-body">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 18 }} />
      ))}
    </div>
  );
}

export function ErrorBox({ error }: { error: RequestError | Error | string }) {
  const msg =
    typeof error === "string" ? error : (error as Error).message ?? "Error";
  return (
    <div className="state error">
      <div className="ic">⚠</div>
      {msg}
    </div>
  );
}

export function Empty({
  children,
  icon = "∅",
}: {
  children: ReactNode;
  icon?: string;
}) {
  return (
    <div className="state">
      <div className="ic">{icon}</div>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- header */

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- button */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent" | "success";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: BtnProps) {
  return (
    <button
      className={[
        "btn",
        variant !== "primary" && variant,
        size !== "md" && size,
        block && "block",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? "…" : children}
    </button>
  );
}

/* ---------------------------------------------------------------- badges */

export function AiBadge({ label = "AI" }: { label?: string }) {
  return (
    <span className="badge ai" title="Generated or ranked by AI">
      ✦ {label}
    </span>
  );
}

const TONE: Record<string, string> = {
  available: "ok",
  active: "ok",
  returned: "ok",
  paid: "ok",
  fulfilled: "ok",
  ready: "info",
  pending: "warn",
  reserved: "warn",
  partial: "warn",
  maintenance: "warn",
  overdue: "danger",
  lost: "danger",
  damaged: "danger",
  unpaid: "danger",
  suspended: "danger",
  expired: "",
  cancelled: "",
  archived: "",
  waived: "info",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONE[status.toLowerCase()] ?? "";
  return <span className={`badge ${tone}`}>{status}</span>;
}

/* ---------------------------------------------------------------- stat card */

export function Stat({
  label,
  value,
  icon,
  delta,
  tone,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  delta?: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="l">{label}</span>
        {icon && <span className="ic">{icon}</span>}
      </div>
      <span className="n">{value}</span>
      {delta && <span className={`delta ${tone ?? ""}`}>{delta}</span>}
    </div>
  );
}

/* ---------------------------------------------------------------- modal */

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="modal"
        style={wide ? { width: "min(760px, calc(100vw - 32px))" } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- tabs */

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`tab ${t.id === active ? "active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="muted"> ({t.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- pagination */

export function Pager({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="pager">
      <span>
        {total.toLocaleString()} item{total === 1 ? "" : "s"}
      </span>
      <div className="row-tight">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ← Prev
        </Button>
        <span>
          Page {page} / {Math.max(pages, 1)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- fields */

export function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/* ---------------------------------------------------------------- confirm */

export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onClose,
  loading,
}: {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body}
    </Modal>
  );
}

/* ---------------------------------------------------------------- helpers */

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function money(n: number, ccy = "₹"): string {
  return `${ccy}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function relativeDue(iso: string): { text: string; tone: string } {
  const days = Math.round(
    (new Date(iso).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0) return { text: `${-days}d overdue`, tone: "danger" };
  if (days === 0) return { text: "due today", tone: "warn" };
  if (days <= 3) return { text: `${days}d left`, tone: "warn" };
  return { text: `${days}d left`, tone: "" };
}
