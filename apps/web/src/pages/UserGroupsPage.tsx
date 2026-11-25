import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { UserGroup } from '@arcade/contracts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FilterBar, FilterTextInput } from '../components/FilterBar';
import { Modal } from '../components/Modal';
import { TableFooter } from '../components/TableFooter';
import {
  CheckboxField,
  PageTitle,
  ResourceMessage,
  ActiveStatusCell,
  BooleanCell,
  errorClass,
  fieldClass,
  inputClass,
  primaryButtonClass,
  toolbarPrimaryButtonClass,
  secondaryButtonClass,
  tableClass,
  tableWrapClass,
  tdClass,
  textButtonClass,
  thClass,
} from '../components/ui';
import {
  createUserGroup,
  clearSaveError,
  deleteUserGroup,
  fetchUserGroups,
  isSystemGroupName,
  updateUserGroup,
} from '../features/identitySlice';
import { useMenuAccess } from '../features/menuAccess';
import { useAppDispatch, useAppSelector } from '../store';

type DialogMode = 'closed' | 'create' | 'edit';

export function UserGroupsPage() {
  const dispatch = useAppDispatch();
  const { canAdd, canEdit, canDelete } = useMenuAccess('/admin/user-groups');
  const showActions = canEdit || canDelete;
  const { groups, groupsStatus, groupsError, saveStatus, saveError } =
    useAppSelector((state) => state.identity);

  const [search, setSearch] = useState('');
  const [dense, setDense] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [dialogMode, setDialogMode] = useState<DialogMode>('closed');
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserGroup | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [systemAdmin, setSystemAdmin] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (groupsStatus === 'idle') void dispatch(fetchUserGroups());
  }, [dispatch, groupsStatus]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groups.filter((group) => !term || group.name.toLowerCase().includes(term));
  }, [groups, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function openCreate() {
    dispatch(clearSaveError());
    setSelectedGroup(null);
    setName('');
    setSystemAdmin(false);
    setActive(true);
    setDialogMode('create');
  }

  function openEdit(group: UserGroup) {
    dispatch(clearSaveError());
    setSelectedGroup(group);
    setName(group.name);
    setSystemAdmin(group.systemAdmin);
    setActive(group.active);
    setDialogMode('edit');
  }

  function closeDialog() {
    setDialogMode('closed');
    setSelectedGroup(null);
  }

  async function saveGroup(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (dialogMode === 'create' && !canAdd) return;
    if (dialogMode === 'edit' && !canEdit) return;
    try {
      if (dialogMode === 'create') {
        await dispatch(createUserGroup({ name: name.trim(), systemAdmin, active })).unwrap();
        setSuccessMessage('User group created successfully.');
      } else if (dialogMode === 'edit' && selectedGroup) {
        await dispatch(updateUserGroup({
          groupId: selectedGroup.id,
          name: name.trim(),
          systemAdmin,
          active,
        })).unwrap();
        await dispatch(fetchUserGroups()).unwrap();
        setSuccessMessage('User group updated successfully.');
      }
      closeDialog();
    } catch {
      // saveError in slice
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await dispatch(deleteUserGroup(deleteTarget.id)).unwrap();
      setDeleteTarget(null);
      setSuccessMessage('User group deleted successfully.');
    } catch {
      // saveError
    }
  }

  const cellClass = dense ? `${tdClass} !py-2` : tdClass;
  return (
    <>
      <PageTitle
        eyebrow="ACCESS CONTROL"
        title="User groups"
        action={canAdd ? (
          <button type="button" className={toolbarPrimaryButtonClass('px-5')} onClick={openCreate}>
            + New
          </button>
        ) : undefined}
      />

      <FilterBar>
        <FilterTextInput
          label="Group Name"
          value={search}
          onChange={(value) => { setSearch(value); setPage(1); }}
          placeholder="Filter group name…"
        />
      </FilterBar>

      {successMessage && (
        <ResourceMessage kind="success">
          {successMessage}
          <button type="button" className={`${textButtonClass} ml-2`} onClick={() => setSuccessMessage(null)}>Dismiss</button>
        </ResourceMessage>
      )}

      {groupsStatus === 'failed' && (
        <ResourceMessage kind="error">
          {groupsError}{' '}
          <button type="button" className={textButtonClass} onClick={() => void dispatch(fetchUserGroups())}>Retry</button>
        </ResourceMessage>
      )}

      {groupsStatus === 'loading' && <ResourceMessage kind="loading">Loading user groups…</ResourceMessage>}

      {groupsStatus === 'succeeded' && (
        <section className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                {showActions && <th className={thClass}>Actions</th>}
                <th className={thClass}>Sr. No.</th>
                <th className={thClass}>Group Name</th>
                <th className={thClass}>System Admin</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td className={tdClass} colSpan={showActions ? 5 : 4}>No user groups found.</td>
                </tr>
              )}
              {pageRows.map((group, index) => (
                <tr key={group.id} className="hover:bg-white/2">
                  {showActions && (
                    <td className={cellClass}>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {canEdit && <button type="button" className={textButtonClass} onClick={() => openEdit(group)}>Edit</button>}
                        {canDelete && !isSystemGroupName(group.name) && (
                          <button type="button" className={textButtonClass} onClick={() => setDeleteTarget(group)}>Delete</button>
                        )}
                      </div>
                    </td>
                  )}
                  <td className={cellClass}>{(currentPage - 1) * pageSize + index + 1}</td>
                  <td className={cellClass}>{group.name}</td>
                  <td className={cellClass}>
                    <BooleanCell value={group.systemAdmin} trueLabel="Yes" falseLabel="No" />
                  </td>
                  <td className={cellClass}>
                    <ActiveStatusCell active={group.active} />
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
        title={dialogMode === 'create' ? 'New user group' : 'Edit user group'}
        onClose={closeDialog}
        footer={(
          <>
            <button type="button" className={secondaryButtonClass()} onClick={closeDialog}>Cancel</button>
            <button type="submit" form="user-group-form" className={primaryButtonClass('w-auto min-w-[88px]')} disabled={saveStatus === 'loading'}>
              {saveStatus === 'loading' ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      >
        <form id="user-group-form" className="grid gap-4" onSubmit={(event) => void saveGroup(event)}>
          <label className={fieldClass}>
            Group Name *
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              autoFocus={dialogMode === 'create'}
            />
          </label>
          <CheckboxField
            label="System Admin"
            checked={systemAdmin}
            onChange={setSystemAdmin}
          />
          <CheckboxField
            label="Active"
            checked={active}
            onChange={setActive}
          />
          {saveError && <div className={errorClass} role="alert">{saveError}</div>}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete user group?"
        message="Are you sure you want to delete this record?"
        confirmLabel="Confirm"
        loading={saveStatus === 'loading'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
