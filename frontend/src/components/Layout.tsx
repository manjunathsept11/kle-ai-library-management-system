import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const item = ({ isActive }: { isActive: boolean }) =>
  isActive ? "active" : undefined;

export default function Layout() {
  const { user, logout } = useAuth();
  const staff = user?.role === "librarian" || user?.role === "admin";

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          KLE Institute
          <small>AI Library System</small>
        </div>

        <NavLink to="/" end className={item}>
          🏠 Dashboard
        </NavLink>
        <NavLink to="/catalogue" className={item}>
          📚 Catalogue
        </NavLink>
        <NavLink to="/ai-search" className={item}>
          ✦ AI Smart Search
        </NavLink>
        <NavLink to="/assistant" className={item}>
          ✦ AI Assistant
        </NavLink>
        <NavLink to="/my-loans" className={item}>
          🔖 My Loans
        </NavLink>

        {staff && (
          <>
            <div className="group-label">Librarian</div>
            <NavLink to="/staff/circulation" className={item}>
              🔁 Issue / Return
            </NavLink>
            <NavLink to="/staff/books" className={item}>
              ➕ Manage Books
            </NavLink>
          </>
        )}

        <div className="spacer" />
        <button className="ghost" style={{ color: "#cfdce6" }} onClick={logout}>
          ⎋ Sign out
        </button>
      </nav>

      <div className="main">
        <header className="topbar">
          <strong>Library</strong>
          <span className="who">
            {user?.full_name} · <span className="badge">{user?.role}</span>
          </span>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
