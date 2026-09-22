import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ApiSuccess, Login, RegisterUser, User, UserRole } from '@arcade/contracts';
import { api } from '../api';

export const AUTH_TOKEN_KEY = 'arcade.auth.token';
export const AUTH_USER_KEY = 'arcade.auth.user';

export type SessionUser = Pick<User, 'id' | 'displayName' | 'email' | 'roles'>;
type Session = { token: string; user: SessionUser };
const validRoles = new Set<UserRole>(['CUSTOMER', 'STAFF', 'ADMIN']);

type AuthState = {
  user: SessionUser | null;
  token: string | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
};

function readSession(): Session | null {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const rawUser = localStorage.getItem(AUTH_USER_KEY);
    if (!token || !rawUser) return null;
    const user = JSON.parse(rawUser) as Partial<SessionUser>;
    if (
      !user.id || !user.displayName || !user.email || !Array.isArray(user.roles) ||
      !user.roles.every((role) => validRoles.has(role))
    ) return null;
    return { token, user: user as SessionUser };
  } catch {
    return null;
  }
}

function persistSession(session: Session): void {
  localStorage.setItem(AUTH_TOKEN_KEY, session.token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
}

function removeSession(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function initialState(): AuthState {
  const savedSession = readSession();
  return {
    user: savedSession?.user ?? null,
    token: savedSession?.token ?? null,
    status: 'idle',
    error: null,
  };
}

export const login = createAsyncThunk<Session, Login>(
  'auth/login',
  async (credentials) => {
    const response = await api<ApiSuccess<Session>>('/api/identity/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    persistSession(response.data);
    return response.data;
  },
);

export const register = createAsyncThunk<Session, RegisterUser>(
  'auth/register',
  async (details, { dispatch }) => {
    await api<ApiSuccess<User>>('/api/identity/auth/register', {
      method: 'POST',
      body: JSON.stringify(details),
    });
    return dispatch(login({ email: details.email, password: details.password })).unwrap();
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      state.status = 'idle';
      state.error = null;
      removeSession();
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        (action) => action.type === login.pending.type || action.type === register.pending.type,
        (state) => {
          state.status = 'loading';
          state.error = null;
        },
      )
      .addMatcher(
        (action): action is ReturnType<typeof login.fulfilled> | ReturnType<typeof register.fulfilled> =>
          action.type === login.fulfilled.type || action.type === register.fulfilled.type,
        (state, action) => {
          state.status = 'succeeded';
          state.token = action.payload.token;
          state.user = action.payload.user;
        },
      )
      .addMatcher(
        (action): action is ReturnType<typeof login.rejected> | ReturnType<typeof register.rejected> =>
          action.type === login.rejected.type || action.type === register.rejected.type,
        (state, action) => {
          state.status = 'failed';
          state.error = action.error.message ?? 'Authentication failed';
        },
      );
  },
});

export const { clearAuthError, logout } = authSlice.actions;
export default authSlice.reducer;
