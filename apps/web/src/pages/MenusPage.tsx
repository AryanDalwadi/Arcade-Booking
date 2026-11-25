import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Menu } from '@arcade/contracts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FilterBar, FilterSelect } from '../components/FilterBar';
import { Modal } from '../components/Modal';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { TableFooter } from '../components/TableFooter';
import {
  ActiveStatusCell,
  BooleanCell,
  CheckboxField,
  PageTitle,
  ResourceMessage,
  errorClass,
  fieldClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  tableClass,
  tableWrapClass,
  tdClass,
  textButtonClass,
  thClass,
  toolbarPrimaryButtonClass,
} from '../components/ui';
import { useMenuAccess } from '../features/menuAccess';
import { isInBranch, menuIndex, rootOf } from '../features/menuTree';
import { clearMenuSaveError, createMenu, deleteMenu, fetchMenuAccess, fetchMenus, updateMenu } from '../features/menusSlice';
import { useAppDispatch, useAppSelector } from '../store';

type MenuKind = 'main' | 'sub';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type DialogMode = 'closed' | 'create' | 'edit';

const emptyForm = {
  label: '',
  icon: '',
  url: '',
  priority: 0,
  active: true,
  expandable: false,
  sysAdmin: true,
  mainMenuId: '',
  parentSubmenuId: '',
};

export function MenusPage() {
  const dispatch = useAppDispatch();
  const { canAdd, canEdit, canDelete } = useMenuAccess('/admin/menus');
  const { menus, menusStatus, menusError, saveStatus, saveError } = useAppSelector((state) => state.menus);

  const [menuType, setMenuType] = useState<MenuKind>('main');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [mainMenuId, setMainMenuId] = useState('');
  const [subMenuId, setSubMenuId] = useState('ALL');
  const [dense, setDense] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [dialogMode, setDialogMode] = useState<DialogMode>('closed');
  const [selected, setSelected] = useState<Menu | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Menu | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (menusStatus === 'idle') void dispatch(fetchMenus());
  }, [dispatch, menusStatus]);

  const byId = useMemo(() => menuIndex(menus), [menus]);
  const expandableMains = useMemo(
    () => menus.filter((menu) => menu.parentId === null && menu.expandable),
    [menus],
  );

  useEffect(() => {
    if (menuType !== 'sub') return;
    if (!expandableMains.some((menu) => menu.id === mainMenuId)) {
      setMainMenuId(expandableMains[0]?.id ?? '');
      setSubMenuId('ALL');
    }
  }, [expandableMains, mainMenuId, menuType]);

  const subMenuOptions = useMemo(() => {
    if (!mainMenuId) return [];
    return menus.filter((menu) => menu.parentId !== null && rootOf(menu, byId).id === mainMenuId);
  }, [byId, mainMenuId, menus]);

  const filtered = useMemo(() => {
    return menus.filter((menu) => {
      if (statusFilter === 'ACTIVE' && !menu.active) return false;
      if (statusFilter === 'INACTIVE' && menu.active) return false;
      if (menuType === 'main') return menu.parentId === null;
      if (menu.parentId === null) return false;
      if (rootOf(menu, byId).id !== mainMenuId) return false;
      if (subMenuId !== 'ALL' && !isInBranch(menu, subMenuId, byId)) return false;
      return true;
    }).sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label));
  }, [byId, mainMenuId, menuType, menus, statusFilter, subMenuId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showActions = canEdit || canDelete;
  const cellClass = dense ? `${tdClass} !py-2` : tdClass;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function patchForm(patch: Partial<typeof emptyForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function openCreate() {
    dispatch(clearMenuSaveError());
    setSelected(null);
    setForm({
      ...emptyForm,
      mainMenuId,
      parentSubmenuId: subMenuId === 'ALL' ? '' : subMenuId,
    });
    setDialogMode('create');
  }

  function openEdit(menu: Menu) {
    dispatch(clearMenuSaveError());
    const root = rootOf(menu, byId);
    const parent = menu.parentId ? byId.get(menu.parentId) : undefined;
    setSelected(menu);
    setForm({
      label: menu.label,
      icon: menu.icon,
      url: menu.url,
      priority: menu.priority,
      active: menu.active,
      expandable: menu.expandable,
      sysAdmin: menu.sysAdmin,
      mainMenuId: root.id,
      parentSubmenuId: parent && parent.parentId ? parent.id : '',
    });
    setDialogMode('edit');
  }

  function closeDialog() {
    setDialogMode('closed');
    setSelected(null);
  }

  async function saveMenu(event: FormEvent) {
    event.preventDefault();
    const parentId = menuType === 'main'
      ? null
      : (form.parentSubmenuId || form.mainMenuId || null);
    if (menuType === 'sub' && !parentId) return;
    const shared = {
      label: form.label.trim(),
      icon: form.icon.trim(),
      url: form.url.trim(),
      priority: form.priority,
      active: form.active,
      sysAdmin: form.sysAdmin,
      expandable: menuType === 'main' ? form.expandable : false,
      parentId,
    };
    try {
      if (dialogMode === 'create') {
        await dispatch(createMenu(shared)).unwrap();
        void dispatch(fetchMenuAccess());
        setSuccessMessage('Menu created successfully.');
      } else if (selected) {
        await dispatch(updateMenu({ id: selected.id, ...shared })).unwrap();
        void dispatch(fetchMenuAccess());
        setSuccessMessage('Menu updated successfully.');
      }
      closeDialog();
    } catch {
      // saveError is rendered from Redux.
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await dispatch(deleteMenu(deleteTarget.id)).unwrap();
      void dispatch(fetchMenuAccess());
      setDeleteTarget(null);
      setSuccessMessage('Menu deleted successfully.');
    } catch {
      // saveError is rendered from Redux.
    }
  }

  const parentChoices = menus.filter((menu) => {
    if (menu.parentId === null || rootOf(menu, byId).id !== form.mainMenuId) return false;
    if (!selected) return true;
    return menu.id !== selected.id && !isInBranch(menu, selected.id, byId);
  });

  return (
    <>
      <PageTitle
        eyebrow="ACCESS"
        title="Menus"
        action={canAdd ? (
          <button
            type="button"
            className={toolbarPrimaryButtonClass('px-5')}
            onClick={openCreate}
            disabled={menuType === 'sub' && expandableMains.length === 0}
          >
            + New
          </button>
        ) : undefined}
      />

      <FilterBar>
        <div className={`grid gap-4 ${menuType === 'sub' ? 'sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
          <FilterSelect
            label="Menu Type"
            value={menuType}
            onChange={(value) => { setMenuType(value as MenuKind); setPage(1); }}
            options={[
              { value: 'main', label: 'Main Menu' },
              { value: 'sub', label: 'Sub Menu' },
            ]}
          />
          {menuType === 'sub' && (
            <FilterSelect
              label="Main Menu Name"
              value={mainMenuId}
              onChange={(value) => { setMainMenuId(value); setSubMenuId('ALL'); setPage(1); }}
              options={expandableMains.length === 0
                ? [{ value: '', label: 'No expandable menus' }]
                : expandableMains.map((menu) => ({ value: menu.id, label: menu.label }))}
            />
          )}
          {menuType === 'sub' && (
            <FilterSelect
              label="Sub Menu Name"
              value={subMenuId}
              onChange={(value) => { setSubMenuId(value); setPage(1); }}
              options={[
                { value: 'ALL', label: 'All' },
                ...subMenuOptions.map((menu) => ({ value: menu.id, label: menu.label })),
              ]}
            />
          )}
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={(value) => { setStatusFilter(value as StatusFilter); setPage(1); }}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
          />
        </div>
      </FilterBar>

      {successMessage && (
        <ResourceMessage kind="success">
          {successMessage}
          <button type="button" className={`${textButtonClass} ml-2`} onClick={() => setSuccessMessage(null)}>Dismiss</button>
        </ResourceMessage>
      )}
      {menusStatus === 'failed' && (
        <ResourceMessage kind="error">
          {menusError}{' '}
          <button type="button" className={textButtonClass} onClick={() => void dispatch(fetchMenus())}>Retry</button>
        </ResourceMessage>
      )}
      {menusStatus === 'loading' && <ResourceMessage kind="loading">Loading menus…</ResourceMessage>}
      {saveStatus === 'failed' && dialogMode === 'closed' && deleteTarget === null && (
        <ResourceMessage kind="error">{saveError}</ResourceMessage>
      )}

      {menusStatus === 'succeeded' && (
        <section className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                {showActions && <th className={thClass}>Actions</th>}
                <th className={thClass}>Sr. No.</th>
                {menuType === 'sub' && <th className={thClass}>Main Menu</th>}
                {menuType === 'sub' && <th className={thClass}>Sub Menu</th>}
                <th className={thClass}>Label</th>
                <th className={thClass}>Icon</th>
                <th className={thClass}>Url</th>
                <th className={thClass}>Priority Id</th>
                <th className={thClass}>Status</th>
                {menuType === 'main' && <th className={thClass}>Expandable</th>}
                <th className={thClass}>Sys Admin</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td className={tdClass} colSpan={menuType === 'main' ? (showActions ? 9 : 8) : (showActions ? 10 : 9)}>
                    No menus found.
                  </td>
                </tr>
              )}
              {pageRows.map((menu, index) => {
                const parent = menu.parentId ? byId.get(menu.parentId) : undefined;
                return (
                  <tr key={menu.id} className="hover:bg-white/2">
                    {showActions && (
                      <td className={cellClass}>
                        <RowActionsMenu
                          onEdit={canEdit ? () => openEdit(menu) : undefined}
                          onDelete={canDelete ? () => setDeleteTarget(menu) : undefined}
                        />
                      </td>
                    )}
                    <td className={cellClass}>{(currentPage - 1) * pageSize + index + 1}</td>
                    {menuType === 'sub' && <td className={cellClass}>{rootOf(menu, byId).label}</td>}
                    {menuType === 'sub' && (
                      <td className={cellClass}>{parent?.parentId ? parent.label : '—'}</td>
                    )}
                    <td className={cellClass}>{menu.label}</td>
                    <td className={cellClass}>{menu.icon}</td>
                    <td className={cellClass}>{menu.url}</td>
                    <td className={cellClass}>{menu.priority}</td>
                    <td className={cellClass}><ActiveStatusCell active={menu.active} /></td>
                    {menuType === 'main' && (
                      <td className={cellClass}><BooleanCell value={menu.expandable} trueLabel="true" falseLabel="false" /></td>
                    )}
                    <td className={cellClass}><BooleanCell value={menu.sysAdmin} trueLabel="true" falseLabel="false" /></td>
                  </tr>
                );
              })}
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
        wide
        title={menuType === 'main' ? 'Main Menu Form' : 'Sub Menu Form'}
        onClose={closeDialog}
        footer={(
          <>
            <button type="button" className={secondaryButtonClass()} onClick={closeDialog}>Cancel</button>
            <button type="submit" form="menu-form" className={primaryButtonClass('w-auto min-w-[88px]')} disabled={saveStatus === 'loading'}>
              {saveStatus === 'loading' ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      >
        <form id="menu-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void saveMenu(event)}>
          {menuType === 'sub' && (
            <>
              <label className={fieldClass}>Main Menu Label *
                <select
                  className={inputClass}
                  value={form.mainMenuId}
                  onChange={(event) => patchForm({ mainMenuId: event.target.value, parentSubmenuId: '' })}
                  required
                >
                  <option value="">Select a main menu</option>
                  {expandableMains.map((menu) => (
                    <option key={menu.id} value={menu.id}>{menu.label}</option>
                  ))}
                </select>
              </label>
              <label className={fieldClass}>Sub Menu Label
                <select
                  className={inputClass}
                  value={form.parentSubmenuId}
                  onChange={(event) => patchForm({ parentSubmenuId: event.target.value })}
                >
                  <option value="">Directly under the main menu</option>
                  {parentChoices.map((menu) => (
                    <option key={menu.id} value={menu.id}>{menu.label}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className={fieldClass}>Label *
            <input className={inputClass} value={form.label} onChange={(event) => patchForm({ label: event.target.value })} required maxLength={100} />
          </label>
          <label className={fieldClass}>Icon *
            <input className={inputClass} value={form.icon} onChange={(event) => patchForm({ icon: event.target.value })} required maxLength={64} placeholder="ic_users" />
          </label>
          <label className={fieldClass}>Url *
            <input className={inputClass} value={form.url} onChange={(event) => patchForm({ url: event.target.value })} required maxLength={255} placeholder="/admin/example" />
          </label>
          <label className={fieldClass}>Priority Id *
            <input
              className={inputClass}
              type="number"
              min={0}
              max={9999}
              value={form.priority}
              onChange={(event) => patchForm({ priority: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : 0 })}
              required
            />
          </label>
          <CheckboxField label="Active" checked={form.active} onChange={(active) => patchForm({ active })} />
          {menuType === 'main' && (
            <CheckboxField
              label="Expandable"
              checked={form.expandable}
              onChange={(expandable) => patchForm({ expandable })}
              hint="Turn this on before this menu can contain submenus."
            />
          )}
          <CheckboxField
            label="Sys Admin"
            checked={form.sysAdmin}
            onChange={(sysAdmin) => patchForm({ sysAdmin })}
            hint="Administrators can open this menu without a separate rights grant."
          />
          {saveError && <div className={`${errorClass} sm:col-span-2`} role="alert">{saveError}</div>}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete menu?"
        message="Deleting this menu also removes its submenus and any rights assigned to them."
        confirmLabel="Confirm"
        loading={saveStatus === 'loading'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
