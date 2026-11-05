import { useEffect } from 'react';
import { PageTitle, ResourceMessage, tableClass, tableWrapClass, tdClass, textButtonClass, thClass } from '../components/ui';
import { fetchUsers } from '../features/identitySlice';
import { useAppDispatch, useAppSelector } from '../store';

export function UsersPage() {
  const dispatch = useAppDispatch();
  const { users, usersStatus, usersError } = useAppSelector((state) => state.identity);

  useEffect(() => {
    if (usersStatus === 'idle') void dispatch(fetchUsers());
  }, [dispatch, usersStatus]);

  return (
    <>
      <PageTitle eyebrow="IDENTITY" title="Players & staff" />
      {usersStatus === 'loading' && <ResourceMessage kind="loading">Loading users…</ResourceMessage>}
      {usersStatus === 'failed' && (
        <ResourceMessage kind="error">
          {usersError} <button className={textButtonClass} onClick={() => void dispatch(fetchUsers())}>Retry</button>
        </ResourceMessage>
      )}
      {usersStatus === 'succeeded' && users.length === 0 && <ResourceMessage kind="empty">No users have registered yet.</ResourceMessage>}
      {users.length > 0 && (
        <section className={tableWrapClass}>
          <table className={tableClass}>
            <thead><tr><th className={thClass}>Display name</th><th className={thClass}>Email</th><th className={thClass}>Roles</th></tr></thead>
            <tbody>{users.map((user) => (
              <tr key={user.id} className="hover:bg-white/2">
                <td className={tdClass}>{user.displayName}</td>
                <td className={tdClass}>{user.email}</td>
                <td className={tdClass}>{user.roles.join(', ') || 'CUSTOMER'}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </>
  );
}
