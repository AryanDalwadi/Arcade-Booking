import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BrandMark, cx, errorClass, fieldClass, inputClass, primaryButtonClass } from '../components/ui';
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
    <main className="login-grid-bg grid min-h-screen grid-cols-[1.1fr_0.9fr] items-center gap-[8vw] p-[8vw] max-lg:grid-cols-1">
      <section className="max-lg:hidden">
        <span className="font-display text-[11px] tracking-[0.22em] text-mint">WELCOME TO THE GRID</span>
        <h1 className="my-5 text-[clamp(50px,8vw,105px)] leading-[0.82] tracking-[-0.07em]">
          BOOK THE<br /><em className="stroke-mint not-italic">EXTRA LIFE.</em>
        </h1>
        <p className="max-w-[540px] leading-7 text-muted">
          Reserve arcade machines, manage your crew, and keep every session running from one neon-lit control room.
        </p>
      </section>
      <form className="grid w-full max-w-[430px] gap-4.5 border border-line-strong border-t-[3px] border-t-violet bg-panel/93 p-[38px] shadow-[0_30px_80px_#0008]" onSubmit={submit}>
        <BrandMark label="NEON ARCADE" />
        <div className="grid grid-cols-2 gap-1.5" role="tablist">
          <button
            type="button"
            className={cx(
              'border px-2.5 py-2.5 text-muted',
              mode === 'login' ? 'border-mint text-mint' : 'border-line bg-input',
            )}
            onClick={() => changeMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={cx(
              'border px-2.5 py-2.5 text-muted',
              mode === 'register' ? 'border-mint text-mint' : 'border-line bg-input',
            )}
            onClick={() => changeMode('register')}
          >
            Register
          </button>
        </div>
        <h2 className="mt-5 -mb-3 text-[28px]">{mode === 'login' ? 'Player sign in' : 'Create player'}</h2>
        {mode === 'register' && (
          <label className={fieldClass}>Display name
            <input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={100} />
          </label>
        )}
        <label className={fieldClass}>Email
          <input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        </label>
        <label className={fieldClass}>Password
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={mode === 'register' ? 8 : 1}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {error && <div className={errorClass} role="alert">{error}</div>}
        <button className={primaryButtonClass()} disabled={status === 'loading'}>
          {status === 'loading' ? 'Connecting…' : mode === 'login' ? 'Enter arcade →' : 'Create account →'}
        </button>
        <small className="m-0 text-xs text-muted">API gateway: {gatewayUrl}</small>
      </form>
    </main>
  );
}
