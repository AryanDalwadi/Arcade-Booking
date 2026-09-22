import type { UserRole } from '@arcade/contracts';
import type { SessionUser } from './authSlice';

export function hasRole(user: SessionUser | null | undefined, role: UserRole): boolean {
  return Boolean(user?.roles.includes(role));
}

export function canAccessAdmin(user: SessionUser | null | undefined): boolean {
  return hasRole(user, 'ADMIN') || hasRole(user, 'STAFF');
}

export function canManageIdentity(user: SessionUser | null | undefined): boolean {
  return hasRole(user, 'ADMIN');
}

export function homeFor(user: SessionUser): string {
  return canAccessAdmin(user) ? '/admin/dashboard' : '/app/dashboard';
}

export function canOpenPath(user: SessionUser, path: string): boolean {
  if (path.startsWith('/admin')) return canAccessAdmin(user);
  if (path.startsWith('/app')) return !canAccessAdmin(user);
  return false;
}
