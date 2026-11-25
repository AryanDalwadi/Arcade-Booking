import { useMemo, useState } from 'react';
import type { Menu, UserRole } from '@arcade/contracts';
import { FilterBar, FilterSelect } from '../components/FilterBar';
import {
  AppCheckbox,
  PageTitle,
  ResourceMessage,
  errorClass,
  primaryButtonClass,
  secondaryButtonClass,
  textButtonClass,
  toolbarPrimaryButtonClass,
} from '../components/ui';
import { buildMenuTree, descendantIds, type MenuNode } from '../features/menuTree';
import { fetchMenuRights, fetchMenus, saveMenuRights } from '../features/menusSlice';
import { useAppDispatch, useAppSelector } from '../store';

type Flags = {
  canAll: boolean;
  canAdd: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canDetails: boolean;
};

const emptyFlags = (): Flags => ({
  canAll: false,
  canAdd: false,
  canDelete: false,
  canEdit: false,
  canDetails: false,
});

const fullFlags = (): Flags => ({
  canAll: true,
  canAdd: true,
  canDelete: true,
  canEdit: true,
  canDetails: true,
});

const actionColumns = [
  ['canAll', 'All'],
  ['canAdd', 'Add'],
  ['canDelete', 'Delete'],
  ['canEdit', 'Edit'],
  ['canDetails', 'Details'],
] as const;

export function MenuRightsPage() {
  const dispatch = useAppDispatch();
  const { menus, menusStatus, menusError, rightsStatus, rightsError, saveStatus, saveError } =
    useAppSelector((state) => state.menus);
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [loadedRole, setLoadedRole] = useState<UserRole | null>(null);
  const [draft, setDraft] = useState<Record<string, Flags>>({});
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const tree = useMemo(() => buildMenuTree(menus), [menus]);

  async function load() {
    setSuccessMessage(null);
    const [menuList, matrix] = await Promise.all([
      dispatch(fetchMenus()).unwrap(),
      dispatch(fetchMenuRights(role)).unwrap(),
    ]);
    const next: Record<string, Flags> = {};
    for (const menu of menuList) {
      const saved = matrix.rights.find((right) => right.menuId === menu.id);
      next[menu.id] = saved
        ? {
          canAll: saved.canAll,
          canAdd: saved.canAdd,
          canDelete: saved.canDelete,
          canEdit: saved.canEdit,
          canDetails: saved.canDetails,
        }
        : emptyFlags();
    }
    setDraft(next);
    setLoadedRole(role);
    setOpenIds(menuList.map((menu) => menu.id));
  }

  function branchIds(id: string) {
    return [id, ...descendantIds(id, menus)];
  }

  function fullyGranted(id: string) {
    return branchIds(id).every((itemId) => {
      const flags = draft[itemId];
      return Boolean(flags?.canAdd && flags.canDelete && flags.canEdit && flags.canDetails);
    });
  }

  function setBranch(id: string, checked: boolean) {
    setDraft((current) => {
      const next = { ...current };
      const flags = checked ? fullFlags() : emptyFlags();
      for (const itemId of branchIds(id)) next[itemId] = flags;
      return next;
    });
  }

  function setAction(id: string, key: typeof actionColumns[number][0], checked: boolean) {
    setDraft((current) => {
      if (key === 'canAll') {
        return { ...current, [id]: checked ? fullFlags() : emptyFlags() };
      }
      const flags = { ...(current[id] ?? emptyFlags()), [key]: checked };
      const canAll = flags.canAdd && flags.canDelete && flags.canEdit && flags.canDetails;
      return { ...current, [id]: { ...flags, canAll } };
    });
  }

  async function save() {
    if (!loadedRole) return;
    try {
      await dispatch(saveMenuRights({
        role: loadedRole,
        rights: menus.map((menu) => ({ menuId: menu.id, ...(draft[menu.id] ?? emptyFlags()) })),
      })).unwrap();
      setSuccessMessage(`Menu rights saved for ${loadedRole}.`);
    } catch {
      // saveError is rendered from Redux.
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="ACCESS"
        title="Menu Rights"
        action={loadedRole ? (
          <button
            type="button"
            className={toolbarPrimaryButtonClass('px-5')}
            onClick={() => void save()}
            disabled={saveStatus === 'loading' || loadedRole !== role}
          >
            {saveStatus === 'loading' ? 'Saving…' : 'Save rights'}
          </button>
        ) : undefined}
      />

      <FilterBar>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <FilterSelect
              label="User Role"
              value={role}
              onChange={(value) => setRole(value as UserRole)}
              options={[
                { value: 'ADMIN', label: 'Admin' },
                { value: 'STAFF', label: 'Staff' },
                { value: 'CUSTOMER', label: 'Customer' },
              ]}
            />
          </div>
          <button
            type="button"
            className={primaryButtonClass('!w-auto px-5')}
            onClick={() => void load().catch(() => undefined)}
            disabled={menusStatus === 'loading' || rightsStatus === 'loading'}
          >
            {menusStatus === 'loading' || rightsStatus === 'loading' ? 'Loading…' : 'Get Data'}
          </button>
        </div>
      </FilterBar>

      {successMessage && (
        <ResourceMessage kind="success">
          {successMessage}
          <button type="button" className={`${textButtonClass} ml-2`} onClick={() => setSuccessMessage(null)}>Dismiss</button>
        </ResourceMessage>
      )}
      {(menusStatus === 'failed' || rightsStatus === 'failed') && (
        <ResourceMessage kind="error">
          {menusError || rightsError}{' '}
          <button type="button" className={textButtonClass} onClick={() => void load().catch(() => undefined)}>Retry</button>
        </ResourceMessage>
      )}
      {saveError && <div className={errorClass} role="alert">{saveError}</div>}

      {loadedRole && (
        <section className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
            <span className="w-5" />
            <span className="flex-1">Menu</span>
            <span className="grid w-[280px] grid-cols-5 text-center max-sm:w-[220px]">
              {actionColumns.map(([, label]) => <span key={label}>{label}</span>)}
            </span>
          </div>
          {tree.length === 0 && <ResourceMessage kind="empty">No menus have been created.</ResourceMessage>}
          {tree.map((node) => (
            <RightsNode
              key={node.id}
              node={node}
              depth={0}
              draft={draft}
              openIds={openIds}
              fullyGranted={fullyGranted}
              onToggleOpen={(id) => setOpenIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
              onBranch={setBranch}
              onAction={setAction}
            />
          ))}
        </section>
      )}
      {loadedRole && loadedRole !== role && (
        <p className="mt-3 text-xs text-muted">Get Data again before saving. The open matrix is still for {loadedRole}.</p>
      )}
      {!loadedRole && menusStatus !== 'loading' && (
        <ResourceMessage kind="empty">Choose a role and click Get Data to edit its menu rights.</ResourceMessage>
      )}
    </>
  );
}

function RightsNode({
  node,
  depth,
  draft,
  openIds,
  fullyGranted,
  onToggleOpen,
  onBranch,
  onAction,
}: {
  node: MenuNode<Menu>;
  depth: number;
  draft: Record<string, Flags>;
  openIds: string[];
  fullyGranted: (id: string) => boolean;
  onToggleOpen: (id: string) => void;
  onBranch: (id: string, checked: boolean) => void;
  onAction: (id: string, key: typeof actionColumns[number][0], checked: boolean) => void;
}) {
  const flags = draft[node.id] ?? emptyFlags();
  const open = openIds.includes(node.id);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3" style={{ paddingLeft: 16 + depth * 20 }}>
        <AppCheckbox
          checked={fullyGranted(node.id)}
          onChange={(checked) => onBranch(node.id, checked)}
          aria-label={`${node.label} rights`}
        />
        {hasChildren ? (
          <button type="button" className={secondaryButtonClass('px-2 py-1 text-xs')} onClick={() => onToggleOpen(node.id)} aria-expanded={open}>
            {open ? '▾' : '▸'}
          </button>
        ) : <span className="w-8" />}
        <span className="min-w-0 flex-1 text-sm text-white">{node.label}</span>
        <span className="grid w-[280px] grid-cols-5 justify-items-center max-sm:w-[220px]">
          {actionColumns.map(([key, label]) => (
            <AppCheckbox
              key={key}
              checked={flags[key]}
              onChange={(checked) => onAction(node.id, key, checked)}
              aria-label={`${node.label} ${label}`}
            />
          ))}
        </span>
      </div>
      {hasChildren && open && node.children.map((child) => (
        <RightsNode
          key={child.id}
          node={child}
          depth={depth + 1}
          draft={draft}
          openIds={openIds}
          fullyGranted={fullyGranted}
          onToggleOpen={onToggleOpen}
          onBranch={onBranch}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
