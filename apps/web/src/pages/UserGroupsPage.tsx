import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageTitle, ResourceMessage } from '../components/ui';
import {
  addGroupMember,
  createUserGroup,
  fetchUserGroups,
  fetchUsers,
  removeGroupMember,
} from '../features/identitySlice';
import { canManageIdentity } from '../features/roles';
import { useAppDispatch, useAppSelector } from '../store';

export function UserGroupsPage() {
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [userId, setUserId] = useState('');
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const canManage = canManageIdentity(user);
  const {
    groups, users, groupsStatus, usersStatus, groupsError,
    createStatus, createError, membershipStatus, membershipError,
  } =
    useAppSelector((state) => state.identity);

  useEffect(() => {
    if (groupsStatus === 'idle') void dispatch(fetchUserGroups());
    if (usersStatus === 'idle') void dispatch(fetchUsers());
  }, [dispatch, groupsStatus, usersStatus]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await dispatch(createUserGroup(name.trim())).unwrap();
      setName('');
    } catch {
      // Redux state renders the API error.
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupId || !userId) return;
    await dispatch(addGroupMember({ groupId, userId })).unwrap();
  }

  return (
    <>
      <PageTitle eyebrow="ACCESS CONTROL" title="User groups" />
      {canManage && <form className="inline-form panel" onSubmit={submit}>
        <label>Group name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <button className="primary" disabled={createStatus === 'loading' || !name.trim()}>
          {createStatus === 'loading' ? 'Creating…' : 'Create group'}
        </button>
        {createError && <div className="error" role="alert">{createError}</div>}
      </form>}
      {canManage && (
        <form className="management-form panel" onSubmit={(event) => void addMember(event).catch(() => undefined)}>
          <label>User
            <select value={userId} onChange={(event) => setUserId(event.target.value)} required>
              <option value="">Select a user</option>
              {users.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName} · {candidate.email}</option>)}
            </select>
          </label>
          <label>Group
            <select value={groupId} onChange={(event) => setGroupId(event.target.value)} required>
              <option value="">Select a group</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <button className="primary" disabled={membershipStatus === 'loading'}>Add member</button>
          {membershipError && <div className="error" role="alert">{membershipError}</div>}
        </form>
      )}
      {!canManage && <ResourceMessage kind="empty">STAFF access is read-only. An ADMIN manages memberships.</ResourceMessage>}
      {groupsStatus === 'loading' && <ResourceMessage kind="loading">Loading user groups…</ResourceMessage>}
      {groupsStatus === 'failed' && (
        <ResourceMessage kind="error">
          {groupsError} <button className="text-button" onClick={() => void dispatch(fetchUserGroups())}>Retry</button>
        </ResourceMessage>
      )}
      {groupsStatus === 'succeeded' && groups.length === 0 && <ResourceMessage kind="empty">No user groups exist yet.</ResourceMessage>}
      {groups.length > 0 && (
        <section className="panel table-wrap">
          <table>
            <thead><tr><th>Group</th><th>Members</th><th>Actions</th></tr></thead>
            <tbody>{groups.map((group) => (
              <tr key={group.id}>
                <td>{group.name}</td>
                <td>
                  {group.members.length === 0
                    ? 'No members'
                    : group.members.map((memberId) =>
                      users.find((candidate) => candidate.id === memberId)?.displayName ?? memberId).join(', ')}
                </td>
                <td>
                  {canManage && group.members.map((memberId) => (
                    <button
                      key={memberId}
                      className="text-button"
                      onClick={() => void dispatch(removeGroupMember({ groupId: group.id, userId: memberId }))}
                    >
                      Remove {users.find((candidate) => candidate.id === memberId)?.displayName ?? 'member'}
                    </button>
                  ))}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </>
  );
}
