import { useEffect } from 'react';
import { PageTitle, ResourceMessage } from '../components/ui';
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
          {usersError} <button className="text-button" onClick={() => void dispatch(fetchUsers())}>Retry</button>
        </ResourceMessage>
      )}
      {usersStatus === 'succeeded' && users.length === 0 && <ResourceMessage kind="empty">No users have registered yet.</ResourceMessage>}
      {users.length > 0 && (
        <section className="panel table-wrap">
          <table>
            <thead><tr><th>Display name</th><th>Email</th><th>Roles</th></tr></thead>
            <tbody>{users.map((user) => (
              <tr key={user.id}><td>{user.displayName}</td><td>{user.email}</td><td>{user.roles.join(', ') || 'CUSTOMER'}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </>
  );
}
