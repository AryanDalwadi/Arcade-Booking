import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { User } from '@arcade/contracts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FilterBar, FilterSelect, FilterTextInput } from '../components/FilterBar';
import { Modal } from '../components/Modal';
import { TableFooter } from '../components/TableFooter';
import {
  CheckboxField,
  PageTitle,
  ResourceMessage,
  ActiveStatusCell,
  errorClass,
  fieldClass,
  inputClass,
  primaryButtonClass,
  toolbarPrimaryButtonClass,
  secondaryButtonClass,
  Select,
  tableClass,
  tableWrapClass,
  tdClass,
  textButtonClass,
  thClass,
} from '../components/ui';
import {
  createUser,
  deleteUser,
  fetchUserGroups,
  fetchUsers,
  setUserGroup,
  updateUser,
} from '../features/identitySlice';
import { useMenuAccess } from '../features/menuAccess';
import { useAppDispatch, useAppSelector } from '../store';

type DialogMode = 'closed' | 'create' | 'edit';

export function UsersPage() {
  const dispatch = useAppDispatch();
  const { canAdd, canEdit, canDelete } = useMenuAccess('/admin/users');
  const showActions = canEdit || canDelete;
  const { users, groups, usersStatus, groupsStatus, usersError, saveStatus, saveError } =
    useAppSelector((state) => state.identity);

  const [nameFilter, setNameFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [dense, setDense] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [dialogMode, setDialogMode] = useState<DialogMode>('closed');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (usersStatus === 'idle') void dispatch(fetchUsers());
    if (groupsStatus === 'idle') void dispatch(fetchUserGroups());
  }, [dispatch, usersStatus, groupsStatus]);

  const filtered = useMemo(() => {
    const nameTerm = nameFilter.trim().toLowerCase();
    const emailTerm = emailFilter.trim().toLowerCase();
    return users.filter((candidate) => {
      if (nameTerm && !candidate.displayName.toLowerCase().includes(nameTerm)) return false;
      if (emailTerm && !candidate.email.toLowerCase().includes(emailTerm)) return false;
      if (groupFilter !== 'ALL' && candidate.groupId !== groupFilter) return false;
      return true;
    });
  }, [users, nameFilter, emailFilter, groupFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const adminCount = useMemo(
    () => users.filter((candidate) => candidate.roles.includes('ADMIN')).length,
    [users],
  );

  const groupOptions = useMemo(
    () => [{ value: 'ALL', label: 'All groups' }, ...groups.map((group) => ({ value: group.id, label: group.name }))],
    [groups],
  );

  function openCreate() {
    setSelectedUser(null);
    setDisplayName('');
    setEmail('');
    setPassword('');
    setShowCreatePassword(false);
    setGroupId(groups[0]?.id ?? '');
    setActive(true);
    setDialogMode('create');
  }

  function openEdit(candidate: User) {
    setSelectedUser(candidate);
    setDisplayName(candidate.displayName);
    setEmail(candidate.email);
    setPassword('');
    setGroupId(candidate.groupId ?? groups[0]?.id ?? '');
    setActive(candidate.active);
    setDialogMode('edit');
  }

  function closeDialog() {
    setDialogMode('closed');
    setSelectedUser(null);
    setShowCreatePassword(false);
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    if (dialogMode === 'create' && !canAdd) return;
    if (dialogMode === 'edit' && !canEdit) return;
    if (!groupId) return;
    try {
      if (dialogMode === 'create') {
        if (!password) return;
        const created = await dispatch(createUser({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          active,
        })).unwrap();
        await dispatch(setUserGroup({ userId: created.id, groupId })).unwrap();
        await dispatch(fetchUsers()).unwrap();
        setSuccessMessage('User created successfully.');
      } else if (selectedUser) {
        const patch: { id: string; displayName: string; active: boolean; password?: string } = {
          id: selectedUser.id,
          displayName: displayName.trim(),
          active,
        };
        if (password.trim()) patch.password = password;
        await dispatch(updateUser(patch)).unwrap();
        if (groupId !== (selectedUser.groupId ?? '')) {
          await dispatch(setUserGroup({ userId: selectedUser.id, groupId })).unwrap();
        }
        await dispatch(fetchUsers()).unwrap();
        setSuccessMessage('User updated successfully.');
      }
      closeDialog();
    } catch {
      // saveError
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBlocked) return;
    try {
      await dispatch(deleteUser(deleteTarget.id)).unwrap();
      setDeleteTarget(null);
      setSuccessMessage('User deleted successfully.');
    } catch {
      // saveError
    }
  }

  const deleteBlocked = deleteTarget?.roles.includes('ADMIN') && adminCount <= 1;
  const cellClass = dense ? `${tdClass} !py-2` : tdClass;
  const loading = usersStatus === 'loading' || usersStatus === 'idle';

  return (
    <>
      <PageTitle
        eyebrow="IDENTITY"
        title="Users"
        action={canAdd ? (
          <button type="button" className={toolbarPrimaryButtonClass('px-5')} onClick={openCreate}>
            + New
          </button>
        ) : undefined}
      />

      <FilterBar>
        <div className="grid gap-4 sm:grid-cols-3">
          <FilterTextInput label="Name" value={nameFilter} onChange={(v) => { setNameFilter(v); setPage(1); }} placeholder="Filter name…" />
          <FilterTextInput label="Email Address" value={emailFilter} onChange={(v) => { setEmailFilter(v); setPage(1); }} placeholder="Filter email…" />
          <FilterSelect label="User Group" value={groupFilter} onChange={(v) => { setGroupFilter(v); setPage(1); }} options={groupOptions} />
        </div>
      </FilterBar>

      {successMessage && (
        <ResourceMessage kind="success">
          {successMessage}
          <button type="button" className={`${textButtonClass} ml-2`} onClick={() => setSuccessMessage(null)}>Dismiss</button>
        </ResourceMessage>
      )}

      {usersStatus === 'failed' && (
        <ResourceMessage kind="error">
          {usersError}{' '}
          <button type="button" className={textButtonClass} onClick={() => void dispatch(fetchUsers())}>Retry</button>
        </ResourceMessage>
      )}

      {loading && <ResourceMessage kind="loading">Loading users…</ResourceMessage>}

      {usersStatus === 'succeeded' && (
        <section className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                {showActions && <th className={thClass}>Actions</th>}
                <th className={thClass}>Sr. No.</th>
                <th className={thClass}>Display Name</th>
                <th className={thClass}>Email Address</th>
                <th className={thClass}>User Group</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td className={tdClass} colSpan={showActions ? 6 : 5}>No users found.</td>
                </tr>
              )}
              {pageRows.map((candidate, index) => (
                <tr key={candidate.id} className="hover:bg-white/2">
                  {showActions && (
                    <td className={cellClass}>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {canEdit && <button type="button" className={textButtonClass} onClick={() => openEdit(candidate)}>Edit</button>}
                        {canDelete && <button type="button" className={textButtonClass} onClick={() => setDeleteTarget(candidate)}>Delete</button>}
                      </div>
                    </td>
                  )}
                  <td className={cellClass}>{(currentPage - 1) * pageSize + index + 1}</td>
                  <td className={cellClass}>{candidate.displayName}</td>
                  <td className={cellClass}>{candidate.email}</td>
                  <td className={cellClass}>{candidate.groupName ?? '—'}</td>
                  <td className={cellClass}>
                    <ActiveStatusCell active={candidate.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TableFooter
            dense={dense}
            onDenseChange={setDense}
            pageSize={pageSize}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            totalRecords={filtered.length}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </section>
      )}

      <Modal
        open={dialogMode !== 'closed'}
        title={dialogMode === 'create' ? 'New user' : 'Edit user'}
        subtitle={dialogMode === 'edit' ? selectedUser?.email : undefined}
        onClose={closeDialog}
        footer={(
          <>
            <button type="button" className={secondaryButtonClass()} onClick={closeDialog}>Cancel</button>
            <button type="submit" form="user-form" className={primaryButtonClass('w-auto min-w-[88px]')} disabled={saveStatus === 'loading'}>
              {saveStatus === 'loading' ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      >
          <form id="user-form" className="grid gap-4" onSubmit={(event) => void saveUser(event)}>
            <label className={fieldClass}>
              Display Name *
              <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </label>
            <label className={fieldClass}>
              Email Address *
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={dialogMode === 'edit'}
              />
            </label>
            {dialogMode === 'create' && (
              <div className={fieldClass}>
                Password *
                <div className="relative">
                  <input
                    className={`${inputClass} pr-11`}
                    type={showCreatePassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded border-0 bg-transparent p-1.5 text-muted transition hover:text-white"
                    aria-pressed={showCreatePassword}
                    aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowCreatePassword((value) => !value)}
                  >
                    {showCreatePassword ? (
                      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
            <label className={fieldClass}>
              User Group *
              <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
                <option value="">Select a group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </Select>
            </label>
            <CheckboxField label="Active" checked={active} onChange={setActive} />
            {saveError && <div className={errorClass} role="alert">{saveError}</div>}
          </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete user?"
        message={deleteBlocked
          ? 'This is the last administrator and cannot be deleted.'
          : 'Are you sure you want to delete this record?'}
        confirmLabel="Confirm"
        loading={saveStatus === 'loading'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
