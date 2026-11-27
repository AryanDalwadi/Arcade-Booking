import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Login, RegisterUser, User, UserRole } from '@arcade/contracts';
import { api } from './api';

const TOKEN_KEY = 'arcade.site.token';
const USER_KEY = 'arcade.site.user';
const roles = new Set<UserRole>(['CUSTOMER', 'STAFF', 'ADMIN']);

export type SessionUser = Pick<User, 'id' | 'displayName' | 'email' | 'roles'>;

type AuthValue = {
  user: SessionUser | null;
  token: string | null;
  login: (input: Login) => Promise<void>;
  register: (input: RegisterUser) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

function readUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || !localStorage.getItem(TOKEN_KEY)) return null;
    const user = JSON.parse(raw) as Partial<SessionUser>;
    if (!user.id || !user.displayName || !user.email || !Array.isArray(user.roles)) return null;
    if (!user.roles.every((role) => roles.has(role))) return null;
    return user as SessionUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(readUser);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const value = useMemo<AuthValue>(() => {
    const login = async (input: Login) => {
      const session = await api<{ token: string; user: SessionUser }>('/api/identity/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      localStorage.setItem(TOKEN_KEY, session.token);
      localStorage.setItem(USER_KEY, JSON.stringify(session.user));
      setToken(session.token);
      setUser(session.user);
    };
    return {
      user,
      token,
      login,
      async register(input: RegisterUser) {
        await api('/api/identity/auth/register', { method: 'POST', body: JSON.stringify(input) });
        await login({ email: input.email, password: input.password });
      },
      logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      },
    };
  }, [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Auth is missing');
  return value;
}
