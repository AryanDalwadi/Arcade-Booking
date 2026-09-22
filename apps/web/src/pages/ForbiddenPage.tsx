import { Link, Navigate } from 'react-router-dom';
import { canAccessAdmin, homeFor } from '../features/roles';
import { useAppSelector } from '../store';

export function ForbiddenPage() {
  const user = useAppSelector((state) => state.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  return (
    <main className="centered-page">
      <section className="panel forbidden-card">
        <span className="eyebrow">403 · ACCESS DENIED</span>
        <h1>That portal is not available for your role.</h1>
        <p>
          Signed in as {user.displayName} ({user.roles.join(', ')}).
          {canAccessAdmin(user) ? ' Use the administration portal.' : ' Use your customer portal.'}
        </p>
        <Link className="primary link-button" to={homeFor(user)}>Return to dashboard</Link>
      </section>
    </main>
  );
}
