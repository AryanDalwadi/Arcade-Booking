import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { gatewayUrl } from '../api';
import { clearAuthError, login, register } from '../features/authSlice';
import { canOpenPath, homeFor } from '../features/roles';
import { useAppDispatch, useAppSelector } from '../store';

type LocationState = { from?: { pathname?: string } };

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = mode === 'login'
      ? login({ email, password })
      : register({ email, password, displayName });
    try {
      const session = await dispatch(action).unwrap();
      const state = location.state as LocationState | null;
      const requestedPath = state?.from?.pathname;
      navigate(
        requestedPath && canOpenPath(session.user, requestedPath)
          ? requestedPath
          : homeFor(session.user),
        { replace: true },
      );
    } catch {
      // Rejected thunk details are rendered from Redux state.
    }
  }

  function changeMode(nextMode: 'login' | 'register') {
    setMode(nextMode);
    dispatch(clearAuthError());
  }

  return (
    <main className="login-page">
      <section className="login-copy">
        <span className="eyebrow">WELCOME TO THE GRID</span>
        <h1>BOOK THE<br /><em>EXTRA LIFE.</em></h1>
        <p>Reserve arcade machines, manage your crew, and keep every session running from one neon-lit control room.</p>
      </section>
      <form className="login-card" onSubmit={submit}>
        <div className="brand"><span>NA</span> NEON ARCADE</div>
        <div className="auth-tabs" role="tablist">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Sign in</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Register</button>
        </div>
        <h2>{mode === 'login' ? 'Player sign in' : 'Create player'}</h2>
        {mode === 'register' && (
          <label>Display name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={100} />
          </label>
        )}
        <label>Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        </label>
        <label>Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={mode === 'register' ? 8 : 1}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" disabled={status === 'loading'}>
          {status === 'loading' ? 'Connecting…' : mode === 'login' ? 'Enter arcade →' : 'Create account →'}
        </button>
        <small>API gateway: {gatewayUrl}</small>
      </form>
    </main>
  );
}
