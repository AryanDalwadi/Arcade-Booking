import { Navigate, Route, Routes } from 'react-router-dom';
import { PortalLayout } from './components/ProtectedLayout';
import { homeFor } from './features/roles';
import { AuthPage } from './pages/AuthPage';
import { BookingsPage } from './pages/BookingsPage';
import { BookingRulesPage } from './pages/BookingRulesPage';
import { CatalogPage } from './pages/CatalogPage';
import { DashboardPage } from './pages/DashboardPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { InclusionsPage } from './pages/InclusionsPage';
import { MenuRightsPage } from './pages/MenuRightsPage';
import { MenusPage } from './pages/MenusPage';
import { PackageDefaultsPage } from './pages/PackageDefaultsPage';
import { PartyTypesPage } from './pages/PartyTypesPage';
import { UserGroupsPage } from './pages/UserGroupsPage';
import { UsersPage } from './pages/UsersPage';
import { VenuesPage } from './pages/VenuesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { useAppSelector } from './store';

function LoginRoute() {
  const user = useAppSelector((state) => state.auth.user);
  return user ? <Navigate to={homeFor(user)} replace /> : <AuthPage />;
}

function RoleHome() {
  const user = useAppSelector((state) => state.auth.user);
  return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}

function UnmappedMenuPage() {
  return <p className="m-0 text-sm text-muted">This menu does not have a page yet.</p>;
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
        <Route path="menus" element={<MenusPage />} />
        <Route path="menu-rights" element={<MenuRightsPage />} />
        <Route path="catalog" element={<CatalogPage manage />} />
        <Route path="venues" element={<VenuesPage />} />
        <Route path="party-types" element={<PartyTypesPage />} />
        <Route path="inclusions" element={<InclusionsPage />} />
        <Route path="package-defaults" element={<PackageDefaultsPage />} />
        <Route path="booking-rules" element={<BookingRulesPage />} />
        <Route path="bookings" element={<BookingsPage portal="admin" />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="*" element={<UnmappedMenuPage />} />
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
