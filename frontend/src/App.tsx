import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import { Loading } from "./components/ui";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Catalogue from "./pages/Catalogue";
import BookDetail from "./pages/BookDetail";
import AiSearch from "./pages/AiSearch";
import Assistant from "./pages/Assistant";
import MyLoans from "./pages/MyLoans";
import StaffCirculation from "./pages/StaffCirculation";
import StaffBooks from "./pages/StaffBooks";
import type { Role } from "./api/types";

function RequireAuth({
  children,
  roles,
}: {
  children: JSX.Element;
  roles?: Role[];
}) {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Starting…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
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
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="catalogue" element={<Catalogue />} />
        <Route path="books/:id" element={<BookDetail />} />
        <Route path="ai-search" element={<AiSearch />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="my-loans" element={<MyLoans />} />
        <Route
          path="staff/circulation"
          element={
            <RequireAuth roles={["librarian", "admin"]}>
              <StaffCirculation />
            </RequireAuth>
          }
        />
        <Route
          path="staff/books"
          element={
            <RequireAuth roles={["librarian", "admin"]}>
              <StaffBooks />
            </RequireAuth>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          loading ? <Loading /> : <Navigate to={user ? "/" : "/login"} replace />
        }
      />
    </Routes>
  );
}
