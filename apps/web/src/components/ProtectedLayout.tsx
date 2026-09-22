import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../features/authSlice';
import { canAccessAdmin } from '../features/roles';
import { useAppDispatch, useAppSelector } from '../store';

const customerRoutes = [
  { path: '/app/dashboard', label: 'My Dashboard', icon: '◫' },
  { path: '/app/catalog', label: 'Arcade Catalog', icon: '▦' },
  { path: '/app/bookings', label: 'My Bookings', icon: '◆' },
];

const adminRoutes = [
  { path: '/admin/dashboard', label: 'Admin Dashboard', icon: '◫' },
  { path: '/admin/users', label: 'Users', icon: '◎' },
  { path: '/admin/user-groups', label: 'User Groups', icon: '◉' },
  { path: '/admin/catalog', label: 'Catalog Management', icon: '▦' },
  { path: '/admin/bookings', label: 'All Bookings', icon: '◆' },
];

export function PortalLayout({ portal }: { portal: 'customer' | 'admin' }) {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (portal === 'admin' && !canAccessAdmin(user)) {
    return <Navigate to="/forbidden" replace />;
  }
  const routes = portal === 'admin' ? adminRoutes : customerRoutes;

  return (
    <div className="shell">
      <aside>
        <div className="brand"><span>NA</span> {portal === 'admin' ? 'ARCADE ADMIN' : 'NEON ARCADE'}</div>
        <nav aria-label="Main navigation">
          {routes.map((item) => (
            <NavLink key={item.path} to={item.path}>
              <i>{item.icon}</i>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="profile">
          <div className="avatar">{user.displayName.charAt(0).toUpperCase()}</div>
          <div><strong>{user.displayName}</strong><small>{user.roles.join(', ') || 'CUSTOMER'}</small></div>
          <button
            title="Sign out"
            onClick={() => {
              dispatch(logout());
              navigate('/login', { replace: true });
            }}
          >↗</button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
