import { Link, Navigate } from 'react-router-dom';
import { panelClass, primaryButtonClass } from '../components/ui';
import { canAccessAdmin, homeFor } from '../features/roles';
import { useAppSelector } from '../store';

export function ForbiddenPage() {
  const user = useAppSelector((state) => state.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className={`${panelClass} w-full max-w-[620px] text-center`}>
        <span className="font-display text-[11px] tracking-[0.22em] text-mint">403 · ACCESS DENIED</span>
        <h1 className="uppercase">That portal is not available for your role.</h1>
        <p className="leading-6 text-muted">
          Signed in as {user.displayName} ({user.roles.join(', ')}).
          {canAccessAdmin(user) ? ' Use the administration portal.' : ' Use your customer portal.'}
        </p>
        <Link className={`${primaryButtonClass('mt-3.5 inline-block w-auto no-underline')} `} to={homeFor(user)}>
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
