import { Navigate, Route, Routes } from 'react-router-dom';
import { PortalLayout } from './components/ProtectedLayout';
import { homeFor } from './features/roles';
import { AuthPage } from './pages/AuthPage';
import { BookingsPage } from './pages/BookingsPage';
import { CatalogPage } from './pages/CatalogPage';
import { DashboardPage } from './pages/DashboardPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { UserGroupsPage } from './pages/UserGroupsPage';
import { UsersPage } from './pages/UsersPage';
import { useAppSelector } from './store';

function LoginRoute() {
  const user = useAppSelector((state) => state.auth.user);
  return user ? <Navigate to={homeFor(user)} replace /> : <AuthPage />;
}

function RoleHome() {
  const user = useAppSelector((state) => state.auth.user);
  return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/app" element={<PortalLayout portal="customer" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage portal="customer" />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="bookings" element={<BookingsPage portal="customer" />} />
      </Route>
      <Route path="/admin" element={<PortalLayout portal="admin" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage portal="admin" />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="user-groups" element={<UserGroupsPage />} />
        <Route path="catalog" element={<CatalogPage manage />} />
        <Route path="bookings" element={<BookingsPage portal="admin" />} />
      </Route>
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route path="/dashboard" element={<RoleHome />} />
      <Route path="/catalog" element={<RoleHome />} />
      <Route path="/bookings" element={<RoleHome />} />
      <Route path="/booking" element={<RoleHome />} />
      <Route path="/" element={<RoleHome />} />
      <Route path="*" element={<RoleHome />} />
    </Routes>
  );
}
