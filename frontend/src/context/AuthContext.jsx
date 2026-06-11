import { createContext, useCallback, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { clearAuth, getToken, getUser, setToken, setUser } from '../utils/storage';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(getToken());
  const [user, setUserState] = useState(getUser());

  const login = useCallback(async (credentials) => {
    const response = await authService.login(credentials);

    if (!response.success) {
      throw new Error(response.message || 'Login failed');
    }

    const { token: authToken, user: authUser } = response.data;

    setToken(authToken);
    setUser(authUser);
    setTokenState(authToken);
    setUserState(authUser);

    return authUser;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setTokenState(null);
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
