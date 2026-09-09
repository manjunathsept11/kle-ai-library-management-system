import { lazy, Suspense, type JSX } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import { Loading } from "./components/ui";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import type { Role } from "./api/types";

const Catalogue = lazy(() => import("./pages/Catalogue"));
const BookDetail = lazy(() => import("./pages/BookDetail"));
const AiSearch = lazy(() => import("./pages/AiSearch"));
const Assistant = lazy(() => import("./pages/Assistant"));
const MyLibrary = lazy(() => import("./pages/MyLibrary"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Profile = lazy(() => import("./pages/Profile"));
const Guide = lazy(() => import("./pages/Guide"));

const StaffCirculation = lazy(() => import("./pages/staff/Circulation"));
const StaffLoans = lazy(() => import("./pages/staff/Loans"));
const StaffReservations = lazy(() => import("./pages/staff/Reservations"));
const StaffFines = lazy(() => import("./pages/staff/Fines"));
const StaffBooks = lazy(() => import("./pages/staff/Books"));
const StaffInventory = lazy(() => import("./pages/staff/Inventory"));
const StaffShelves = lazy(() => import("./pages/staff/Shelves"));
const StaffTaxonomy = lazy(() => import("./pages/staff/Taxonomy"));

const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminDepartments = lazy(() => import("./pages/admin/Departments"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminAudit = lazy(() => import("./pages/admin/Audit"));

function Guard({ children, roles }: { children: JSX.Element; roles?: Role[] }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Starting…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

const STAFF: Role[] = ["librarian", "admin"];
const ADMIN: Role[] = ["admin"];

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/" replace /> : <Register />}
        />

        <Route
          element={
            <Guard>
              <Layout />
            </Guard>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="catalogue" element={<Catalogue />} />
          <Route path="books/:id" element={<BookDetail />} />
          <Route path="ai-search" element={<AiSearch />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="my-library" element={<MyLibrary />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="guide" element={<Guide />} />

          <Route
            path="staff/circulation"
            element={<Guard roles={STAFF}><StaffCirculation /></Guard>}
          />
          <Route
            path="staff/loans"
            element={<Guard roles={STAFF}><StaffLoans /></Guard>}
          />
          <Route
            path="staff/reservations"
            element={<Guard roles={STAFF}><StaffReservations /></Guard>}
          />
          <Route
            path="staff/fines"
            element={<Guard roles={STAFF}><StaffFines /></Guard>}
          />
          <Route
            path="staff/books"
            element={<Guard roles={STAFF}><StaffBooks /></Guard>}
          />
          <Route
            path="staff/inventory"
            element={<Guard roles={STAFF}><StaffInventory /></Guard>}
          />
          <Route
            path="staff/shelves"
            element={<Guard roles={STAFF}><StaffShelves /></Guard>}
          />
          <Route
            path="staff/taxonomy"
            element={<Guard roles={STAFF}><StaffTaxonomy /></Guard>}
          />

          <Route
            path="admin/users"
            element={<Guard roles={ADMIN}><AdminUsers /></Guard>}
          />
          <Route
            path="admin/departments"
            element={<Guard roles={ADMIN}><AdminDepartments /></Guard>}
          />
          <Route
            path="admin/reports"
            element={<Guard roles={ADMIN}><AdminReports /></Guard>}
          />
          <Route
            path="admin/settings"
            element={<Guard roles={ADMIN}><AdminSettings /></Guard>}
          />
          <Route
            path="admin/audit"
            element={<Guard roles={ADMIN}><AdminAudit /></Guard>}
          />
        </Route>

        <Route
          path="*"
          element={
            loading ? <Loading /> : <Navigate to={user ? "/" : "/login"} replace />
          }
        />
      </Routes>
    </Suspense>
  );
}
