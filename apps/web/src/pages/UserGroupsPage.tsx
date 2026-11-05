import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  PageTitle,
  ResourceMessage,
  errorClass,
  fieldClass,
  inputClass,
  panelClass,
  primaryButtonClass,
  tableClass,
  tableWrapClass,
  tdClass,
  textButtonClass,
  thClass,
} from '../components/ui';
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
      {canManage && <form className={`${panelClass} mb-5.5 grid grid-cols-[1fr_180px] items-end gap-4 max-sm:grid-cols-1`} onSubmit={submit}>
        <label className={fieldClass}>Group name<input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <button className={primaryButtonClass()} disabled={createStatus === 'loading' || !name.trim()}>
          {createStatus === 'loading' ? 'Creating…' : 'Create group'}
        </button>
        {createError && <div className={`${errorClass} col-span-full`} role="alert">{createError}</div>}
      </form>}
      {canManage && (
        <form className={`${panelClass} mb-5.5 grid grid-cols-[repeat(4,minmax(130px,1fr))] items-end gap-3.5 max-sm:grid-cols-1`} onSubmit={(event) => void addMember(event).catch(() => undefined)}>
          <label className={fieldClass}>User
            <select className={inputClass} value={userId} onChange={(event) => setUserId(event.target.value)} required>
              <option value="">Select a user</option>
              {users.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName} · {candidate.email}</option>)}
            </select>
          </label>
          <label className={fieldClass}>Group
            <select className={inputClass} value={groupId} onChange={(event) => setGroupId(event.target.value)} required>
              <option value="">Select a group</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <button className={primaryButtonClass()} disabled={membershipStatus === 'loading'}>Add member</button>
          {membershipError && <div className={`${errorClass} col-span-full`} role="alert">{membershipError}</div>}
        </form>
      )}
      {!canManage && <ResourceMessage kind="empty">STAFF access is read-only. An ADMIN manages memberships.</ResourceMessage>}
      {groupsStatus === 'loading' && <ResourceMessage kind="loading">Loading user groups…</ResourceMessage>}
      {groupsStatus === 'failed' && (
        <ResourceMessage kind="error">
          {groupsError} <button className={textButtonClass} onClick={() => void dispatch(fetchUserGroups())}>Retry</button>
        </ResourceMessage>
      )}
      {groupsStatus === 'succeeded' && groups.length === 0 && <ResourceMessage kind="empty">No user groups exist yet.</ResourceMessage>}
      {groups.length > 0 && (
        <section className={tableWrapClass}>
          <table className={tableClass}>
            <thead><tr><th className={thClass}>Group</th><th className={thClass}>Members</th><th className={thClass}>Actions</th></tr></thead>
            <tbody>{groups.map((group) => (
              <tr key={group.id} className="hover:bg-white/2">
                <td className={tdClass}>{group.name}</td>
                <td className={tdClass}>
                  {group.members.length === 0
                    ? 'No members'
                    : group.members.map((memberId) =>
                      users.find((candidate) => candidate.id === memberId)?.displayName ?? memberId).join(', ')}
                </td>
                <td className={tdClass}>
                  {canManage && group.members.map((memberId) => (
                    <button
                      key={memberId}
                      className={textButtonClass}
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
