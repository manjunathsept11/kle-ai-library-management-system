import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme";

interface Cmd {
  label: string;
  hint?: string;
  run: () => void;
  keywords?: string;
}

export default function CommandPalette() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const { toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const staff = user?.role === "librarian" || user?.role === "admin";
  const admin = user?.role === "admin";

  const commands = useMemo<Cmd[]>(() => {
    const go = (to: string) => () => {
      nav(to);
      setOpen(false);
    };
    const list: Cmd[] = [
      { label: "Dashboard", run: go("/"), hint: "Go" },
      { label: "Catalogue", run: go("/catalogue"), hint: "Go" },
      { label: "AI Smart Search", run: go("/ai-search"), hint: "Go", keywords: "semantic" },
      { label: "AI Assistant", run: go("/assistant"), hint: "Go", keywords: "chat bot" },
      { label: "My Library", run: go("/my-library"), hint: "Go", keywords: "loans reservations fines history" },
      { label: "Favorites", run: go("/favorites"), hint: "Go", keywords: "saved" },
      { label: "Notifications", run: go("/notifications"), hint: "Go" },
      { label: "How to use the platform", run: go("/guide"), hint: "Go", keywords: "help guide" },
      { label: "My Profile", run: go("/profile"), hint: "Go", keywords: "password settings" },
      { label: "Toggle light / dark theme", run: () => { toggle(); setOpen(false); }, hint: "Action" },
      { label: "Sign out", run: () => { setOpen(false); logout(); }, hint: "Action" },
    ];
    if (staff)
      list.push(
        { label: "Circulation Desk", run: go("/staff/circulation"), hint: "Staff", keywords: "issue return" },
        { label: "Loans & Returns", run: go("/staff/loans"), hint: "Staff" },
        { label: "Reservations queue", run: go("/staff/reservations"), hint: "Staff" },
        { label: "Fines", run: go("/staff/fines"), hint: "Staff", keywords: "payment waive" },
        { label: "Book Management", run: go("/staff/books"), hint: "Staff", keywords: "add archive" },
        { label: "Inventory", run: go("/staff/inventory"), hint: "Staff", keywords: "copies barcode" },
        { label: "Shelves", run: go("/staff/shelves"), hint: "Staff" },
        { label: "Categories & Publishers", run: go("/staff/taxonomy"), hint: "Staff" },
      );
    if (admin)
      list.push(
        { label: "Users", run: go("/admin/users"), hint: "Admin" },
        { label: "Departments", run: go("/admin/departments"), hint: "Admin" },
        { label: "Reports", run: go("/admin/reports"), hint: "Admin" },
        { label: "Settings", run: go("/admin/settings"), hint: "Admin" },
        { label: "Audit Log", run: go("/admin/audit"), hint: "Admin" },
      );
    return list;
  }, [nav, staff, admin, toggle, logout]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? commands.filter((c) =>
          (c.label + " " + (c.keywords ?? "") + " " + (c.hint ?? ""))
            .toLowerCase()
            .includes(term),
        )
      : commands;
    const extra: Cmd[] =
      term.length > 1
        ? [
            {
              label: `Search catalogue for “${q.trim()}”`,
              hint: "Search",
              run: () => {
                nav(`/catalogue?q=${encodeURIComponent(q.trim())}`);
                setOpen(false);
              },
            },
            {
              label: `Ask the AI assistant “${q.trim()}”`,
              hint: "AI",
              run: () => {
                nav(`/ai-search`);
                setOpen(false);
              },
            },
          ]
        : [];
    return [...base, ...extra];
  }, [q, commands, nav]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQ("");
        setSel(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const openEvt = () => {
      setOpen(true);
      setQ("");
      setSel(0);
    };
    window.addEventListener("keydown", h);
    window.addEventListener("cmdk:open", openEvt);
    return () => {
      window.removeEventListener("keydown", h);
      window.removeEventListener("cmdk:open", openEvt);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  useEffect(() => setSel(0), [q]);

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onMouseDown={() => setOpen(false)}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Jump to a page, search, or run an action…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              filtered[sel]?.run();
            }
          }}
        />
        <div className="cmdk-list">
          {filtered.length === 0 && (
            <div className="cmdk-empty">No matches</div>
          )}
          {filtered.map((c, i) => (
            <button
              key={c.label}
              className={`cmdk-item ${i === sel ? "sel" : ""}`}
              onMouseEnter={() => setSel(i)}
              onClick={c.run}
            >
              <span>{c.label}</span>
              {c.hint && <span className="badge">{c.hint}</span>}
            </button>
          ))}
        </div>
        <div className="cmdk-foot">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
