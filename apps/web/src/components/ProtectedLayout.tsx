import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark, cx } from './ui';
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
  { path: '/admin/notifications', label: 'Notifications', icon: '✉' },
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
    <div className="grid min-h-screen grid-cols-[245px_minmax(0,1fr)] max-lg:grid-cols-[76px_minmax(0,1fr)]">
      <aside className="sticky top-0 flex h-screen flex-col border-r border-line bg-void-deep/94 px-[18px] py-7 max-lg:px-2.5 max-lg:py-6">
        <BrandMark compactOnNarrow label={portal === 'admin' ? 'ARCADE ADMIN' : 'NEON ARCADE'} />
        <nav className="mt-[52px] grid gap-1.5" aria-label="Main navigation">
          {routes.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cx(
                'rounded-md px-3.5 py-3 text-left text-muted no-underline transition hover:bg-nav hover:text-white max-lg:px-2 max-lg:text-center max-lg:text-[0px]',
                isActive && 'border-l-[3px] border-mint bg-nav text-white',
              )}
            >
              <i className="mr-1 inline-block w-7 not-italic text-[#656a83] max-lg:mr-0 max-lg:w-auto max-lg:text-lg">{item.icon}</i>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-line pt-5">
          <div className="grid size-9 place-items-center rounded-full bg-violet font-display text-sm">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="max-lg:hidden">
            <strong className="block text-xs">{user.displayName}</strong>
            <small className="mt-0.5 block text-xs text-faint">{user.roles.join(', ') || 'CUSTOMER'}</small>
          </div>
          <button
            className="ml-auto border-0 bg-transparent text-muted max-lg:hidden"
            title="Sign out"
            onClick={() => {
              dispatch(logout());
              navigate('/login', { replace: true });
            }}
          >↗</button>
        </div>
      </aside>
      <main className="min-w-0 overflow-auto px-[clamp(24px,5vw,72px)] py-[42px] max-sm:px-4 max-sm:py-7">
        <Outlet />
      </main>
    </div>
  );
}
