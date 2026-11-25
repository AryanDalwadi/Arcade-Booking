import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { MenuAccess } from '@arcade/contracts';
import { BrandMark, cx } from './ui';
import { logout } from '../features/authSlice';
import { menuGrants } from '../features/menuAccess';
import { buildMenuTree, type MenuNode } from '../features/menuTree';
import { fetchMenuAccess } from '../features/menusSlice';
import { canAccessAdmin } from '../features/roles';
import { useAppDispatch, useAppSelector } from '../store';

const customerRoutes = [
  { path: '/app/dashboard', label: 'My Dashboard', icon: '◫' },
  { path: '/app/catalog', label: 'Arcade Catalog', icon: '▦' },
  { path: '/app/bookings', label: 'My Bookings', icon: '◆' },
];

export function PortalLayout({ portal }: { portal: 'customer' | 'admin' }) {
  const user = useAppSelector((state) => state.auth.user);
  const menuAccess = useAppSelector((state) => state.menus.access);
  const accessStatus = useAppSelector((state) => state.menus.accessStatus);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (portal === 'admin') void dispatch(fetchMenuAccess());
  }, [dispatch, portal]);

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (portal === 'admin' && !canAccessAdmin(user)) {
    return <Navigate to="/forbidden" replace />;
  }
  if (portal === 'admin' && accessStatus === 'failed' && !user.roles.includes('ADMIN')) {
    return <Navigate to="/forbidden" replace />;
  }
  if (
    portal === 'admin'
    && accessStatus === 'succeeded'
    && !canOpenAdminPath(location.pathname, menuAccess)
  ) {
    return <Navigate to="/forbidden" replace />;
  }
  const adminTree = buildMenuTree(menuAccess);

  return (
    <div className="grid min-h-screen grid-cols-[272px_minmax(0,1fr)] max-lg:grid-cols-[76px_minmax(0,1fr)]">
      <aside className="sticky top-0 flex h-screen min-h-0 flex-col border-r border-line bg-void-deep/94 px-3 py-7 max-lg:px-2.5 max-lg:py-6">
        <BrandMark compactOnNarrow label={portal === 'admin' ? 'ARCADE ADMIN' : 'NEON ARCADE'} />
        <nav className="mt-8 grid min-h-0 flex-1 content-start gap-1 overflow-y-auto" aria-label="Main navigation">
          {portal === 'admin'
            ? <AdminNav nodes={adminTree} />
            : customerRoutes.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                <NavGlyph icon={item.icon} />
                <span className="min-w-0 flex-1 leading-snug max-lg:sr-only">{item.label}</span>
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

function canOpenAdminPath(pathname: string, access: MenuAccess[]): boolean {
  const path = pathname.replace(/\/$/, '') || '/admin';
  if (path === '/admin') return true;
  const match = access.find((menu) => menu.url === path);
  return menuGrants(match).canOpen;
}

function navLinkClass(isActive: boolean) {
  return cx(
    'flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm leading-snug text-muted no-underline transition hover:bg-nav hover:text-white max-lg:justify-center max-lg:px-1',
    isActive && 'border-l-[3px] border-mint bg-nav text-white',
  );
}

function NavGlyph({ icon }: { icon: string }) {
  return <MenuIcon icon={icon} active={false} />;
}

function AdminNav({ nodes }: { nodes: MenuNode<MenuAccess>[] }) {
  const location = useLocation();
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const needed = branchIdsToOpen(nodes, location.pathname);
    setOpenIds((current) => {
      if (needed.every((id) => current.has(id))) return current;
      const next = new Set(current);
      for (const id of needed) next.add(id);
      return next;
    });
  }, [nodes, location.pathname]);

  const toggle = (id: string) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AdminNavList nodes={nodes} depth={0} openIds={openIds} onToggle={toggle} />
  );
}

function AdminNavList({
  nodes,
  depth,
  openIds,
  onToggle,
}: {
  nodes: MenuNode<MenuAccess>[];
  depth: number;
  openIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (nodes.length === 0) return null;
  return (
    <div className={cx('grid min-w-0', depth === 0 ? 'gap-1' : 'mt-0.5 gap-0.5 pl-3.5')}>
      {nodes.map((node) => (
        <AdminNavItem
          key={node.id}
          node={node}
          depth={depth}
          openIds={openIds}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function AdminNavItem({
  node,
  depth,
  openIds,
  onToggle,
}: {
  node: MenuNode<MenuAccess>;
  depth: number;
  openIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const grants = menuGrants(node);
  const hasChildren = node.children.length > 0;
  if (!grants.canOpen && !hasChildren) return null;
  const open = openIds.has(node.id);
  const rowClass = (active: boolean) => cx(
    'flex w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm no-underline transition',
    depth === 0 && 'max-lg:justify-center max-lg:px-1',
    active ? 'bg-mint/15 font-medium text-white' : 'bg-transparent text-muted hover:bg-nav hover:text-white',
  );

  return (
    <div className="grid min-w-0">
      {hasChildren ? (
        <button
          type="button"
          className={cx(rowClass(open), 'border-0')}
          aria-expanded={open}
          onClick={() => onToggle(node.id)}
        >
          <MenuIcon icon={node.icon} active={open} />
          <span className="min-w-0 flex-1 truncate leading-snug max-lg:sr-only">{node.label}</span>
          <ChevronIcon className={cx('size-4 shrink-0 transition', open ? '' : '-rotate-90')} />
        </button>
      ) : (
        <NavLink to={node.url} end className={({ isActive }) => rowClass(isActive)}>
          {({ isActive }) => (
            <>
              <MenuIcon icon={node.icon} active={isActive} />
              <span className="min-w-0 flex-1 truncate leading-snug max-lg:sr-only">{node.label}</span>
            </>
          )}
        </NavLink>
      )}
      {hasChildren && open && (
        <AdminNavList nodes={node.children} depth={depth + 1} openIds={openIds} onToggle={onToggle} />
      )}
    </div>
  );
}

function MenuIcon({ icon, active }: { icon: string; active: boolean }) {
  const text = icon.trim();
  const compact = [...text].length <= 2;
  return (
    <span
      className={cx(
        'shrink-0 leading-none',
        compact ? 'grid h-7 w-7 place-items-center text-base' : 'text-sm',
        active ? 'text-white' : 'text-[#8b90a8]',
      )}
      aria-hidden
    >
      {text}
    </span>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function branchIdsToOpen(nodes: MenuNode<MenuAccess>[], pathname: string): string[] {
  const path = pathname.replace(/\/$/, '') || '/admin';
  const walk = (list: MenuNode<MenuAccess>[], trail: string[]): string[] | null => {
    for (const node of list) {
      const next = [...trail, node.id];
      if (node.url.replace(/\/$/, '') === path) return node.children.length > 0 ? next : trail;
      const found = walk(node.children, next);
      if (found) return found;
    }
    return null;
  };
  return walk(nodes, []) ?? [];
}
