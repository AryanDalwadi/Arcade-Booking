import { useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/account/bookings';
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    setPending(true);
    setError('');
    try {
      if (mode === 'register') {
        await register({ email, password, displayName: String(form.get('displayName') ?? '') });
      } else {
        await login({ email, password });
      }
      navigate(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign in failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4 rounded-3xl border border-line bg-panel p-6">
      <h1 className="font-display text-3xl">{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
      {mode === 'register' && <Field label="Name" name="displayName" required />}
      <Field label="Email" name="email" type="email" required />
      <Field label="Password" name="password" type="password" required minLength={mode === 'register' ? 8 : 1} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-mint py-3 font-semibold text-mint-ink">
        {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
      </button>
      <button type="button" className="text-sm text-muted" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account? Register' : 'Already registered? Sign in'}
      </button>
    </form>
  );
}

function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <input {...props} className="mt-1 w-full rounded-2xl border border-line bg-void px-3 py-3" />
    </label>
  );
}
