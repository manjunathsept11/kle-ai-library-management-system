import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme";
import { api } from "../api/client";
import type { NotificationList } from "../api/types";
import { fmtDateTime } from "./ui";

interface NavEntry {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  badge?: number;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("kle.nav.collapsed") === "1",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 760,
  );
  const [notifs, setNotifs] = useState<NotificationList | null>(null);
  const [menu, setMenu] = useState<"none" | "notif" | "profile">("none");
  const menuRef = useRef<HTMLDivElement>(null);

  const staff = user?.role === "librarian" || user?.role === "admin";
  const admin = user?.role === "admin";

  useEffect(() => {
    localStorage.setItem("kle.nav.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 760);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => setMobileOpen(false), [loc.pathname]);

  // One control: opens the drawer on small screens, collapses the rail on wide.
  const toggleNav = () =>
    isMobile ? setMobileOpen((o) => !o) : setCollapsed((c) => !c);

  const loadNotifs = () =>
    api<NotificationList>("/me/notifications")
      .then(setNotifs)
      .catch(() => {});

  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenu("none");
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);

  const memberNav: NavEntry[] = [
    { to: "/", label: "Dashboard", icon: "◉", end: true },
    { to: "/catalogue", label: "Catalogue", icon: "▤" },
    { to: "/ai-search", label: "AI Smart Search", icon: "✦" },
    { to: "/assistant", label: "AI Assistant", icon: "✦" },
    { to: "/my-library", label: "My Library", icon: "▦" },
    { to: "/favorites", label: "Favorites", icon: "★" },
    {
      to: "/notifications",
      label: "Notifications",
      icon: "◔",
      badge: notifs?.unread,
    },
    { to: "/guide", label: "How to use", icon: "?" },
  ];
  const staffNav: NavEntry[] = [
    { to: "/staff/circulation", label: "Circulation Desk", icon: "⇄" },
    { to: "/staff/loans", label: "Loans & Returns", icon: "⟳" },
    { to: "/staff/reservations", label: "Reservations", icon: "⧗" },
    { to: "/staff/fines", label: "Fines", icon: "₹" },
    { to: "/staff/books", label: "Books", icon: "▤" },
    { to: "/staff/inventory", label: "Inventory", icon: "▣" },
    { to: "/staff/shelves", label: "Shelves", icon: "☷" },
    { to: "/staff/taxonomy", label: "Categories", icon: "❏" },
  ];
  const adminNav: NavEntry[] = [
    { to: "/admin/users", label: "Users", icon: "◈" },
    { to: "/admin/departments", label: "Departments", icon: "⬡" },
    { to: "/admin/reports", label: "Reports", icon: "▨" },
    { to: "/admin/settings", label: "Settings", icon: "⚙" },
    { to: "/admin/audit", label: "Audit Log", icon: "☰" },
  ];

  const renderNav = (entries: NavEntry[]) =>
    entries.map((e) => (
      <NavLink
        key={e.to}
        to={e.to}
        end={e.end}
        className={({ isActive }) =>
          "nav-item" +
          (isActive ? " active" : "") +
          (e.badge ? " has-badge" : "")
        }
        title={e.label}
      >
        <span className="ic">{e.icon}</span>
        <span>{e.label}</span>
        {!!e.badge && <span className="pill">{e.badge}</span>}
      </NavLink>
    ));

  return (
    <div
      className={
        "shell" +
        (collapsed && !isMobile ? " collapsed" : "") +
        (mobileOpen ? " nav-open" : "")
      }
    >
      {mobileOpen && (
        <button
          className="nav-scrim"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span className="mark">KL</span>
          <span className="name">
            KLE Institute
            <small>AI Library</small>
          </span>
          <button
            className="icon-btn collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {renderNav(memberNav)}

        {staff && (
          <>
            <div className="nav-section-label">Librarian</div>
            {renderNav(staffNav)}
          </>
        )}
        {admin && (
          <>
            <div className="nav-section-label">Administrator</div>
            {renderNav(adminNav)}
          </>
        )}

        <div className="sidebar-foot">
          <button className="nav-item" onClick={logout}>
            <span className="ic">⎋</span>
            <span>Sign out</span>
          </button>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn"
            onClick={toggleNav}
            aria-label={isMobile ? "Open menu" : "Collapse sidebar"}
            title="Menu"
          >
            ☰
          </button>
          <span className="crumb">
            {crumbFor(loc.pathname)}
          </span>

          <div className="right" style={{ display: "flex", gap: 4 }}>
            <button
              className="icon-btn"
              onClick={toggle}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>

            <div style={{ position: "relative" }} ref={menu === "notif" ? menuRef : null}>
              <button
                className="icon-btn"
                onClick={() => setMenu((m) => (m === "notif" ? "none" : "notif"))}
                aria-label="Notifications"
              >
                ◔
                {!!notifs?.unread && <span className="dot" />}
              </button>
              {menu === "notif" && (
                <div className="menu" style={{ minWidth: 300 }}>
                  <div className="menu-head spread">
                    <strong>Notifications</strong>
                    {!!notifs?.unread && (
                      <button
                        className="btn ghost sm"
                        onClick={async () => {
                          await api("/me/notifications/read-all", {
                            method: "POST",
                          });
                          loadNotifs();
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifs && notifs.items.length ? (
                    notifs.items.slice(0, 8).map((n) => (
                      <button
                        key={n.id}
                        onClick={async () => {
                          await api(`/me/notifications/${n.id}/read`, {
                            method: "POST",
                          });
                          setMenu("none");
                          loadNotifs();
                          if (n.link) nav(n.link);
                        }}
                        style={{
                          display: "block",
                          opacity: n.is_read ? 0.6 : 1,
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>
                          {n.title}
                        </div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {fmtDateTime(n.created_at)}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="muted" style={{ padding: 12, fontSize: 12 }}>
                      Nothing new.
                    </div>
                  )}
                  <button onClick={() => { setMenu("none"); nav("/notifications"); }}>
                    View all →
                  </button>
                </div>
              )}
            </div>

            <div style={{ position: "relative" }} ref={menu === "profile" ? menuRef : null}>
              <button
                className="icon-btn"
                onClick={() =>
                  setMenu((m) => (m === "profile" ? "none" : "profile"))
                }
                style={{ width: "auto", padding: "0 8px", gap: 7 }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--primary)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {initials(user?.full_name)}
                </span>
                <span className="hide-sm" style={{ fontSize: 12.5 }}>
                  {user?.full_name?.split(" ")[0]}
                </span>
              </button>
              {menu === "profile" && (
                <div className="menu">
                  <div className="menu-head">
                    <div style={{ fontWeight: 600 }}>{user?.full_name}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {user?.email}
                    </div>
                    <span className="badge" style={{ marginTop: 4 }}>
                      {user?.role}
                    </span>
                  </div>
                  <button onClick={() => { setMenu("none"); nav("/profile"); }}>
                    ◈ My profile
                  </button>
                  <button onClick={() => { setMenu("none"); toggle(); }}>
                    {theme === "dark" ? "☀ Light theme" : "☾ Dark theme"}
                  </button>
                  <button onClick={logout}>⎋ Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function initials(name?: string): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase();
}

const CRUMBS: [string, string][] = [
  ["/catalogue", "Catalogue"],
  ["/books/", "Book details"],
  ["/ai-search", "AI Smart Search"],
  ["/assistant", "AI Assistant"],
  ["/my-library", "My Library"],
  ["/favorites", "Favorites"],
  ["/notifications", "Notifications"],
  ["/guide", "How to use the platform"],
  ["/profile", "My Profile"],
  ["/staff/circulation", "Circulation Desk"],
  ["/staff/loans", "Loans & Returns"],
  ["/staff/reservations", "Reservations"],
  ["/staff/fines", "Fines"],
  ["/staff/books", "Book Management"],
  ["/staff/inventory", "Inventory"],
  ["/staff/shelves", "Shelves"],
  ["/staff/taxonomy", "Categories & Publishers"],
  ["/admin/users", "Users"],
  ["/admin/departments", "Departments"],
  ["/admin/reports", "Reports"],
  ["/admin/settings", "Settings"],
  ["/admin/audit", "Audit Log"],
];

function crumbFor(path: string): string {
  for (const [prefix, label] of CRUMBS)
    if (path.startsWith(prefix)) return label;
  return "Dashboard";
}
