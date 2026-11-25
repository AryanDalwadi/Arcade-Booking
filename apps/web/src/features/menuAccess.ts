import type { MenuAccess } from '@arcade/contracts';
import { useAppSelector } from '../store';

export type MenuGrants = {
  canAdd: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canDetails: boolean;
  canOpen: boolean;
};

const closed: MenuGrants = {
  canAdd: false,
  canDelete: false,
  canEdit: false,
  canDetails: false,
  canOpen: false,
};

export function menuGrants(item: Pick<MenuAccess, 'canAll' | 'canAdd' | 'canDelete' | 'canEdit' | 'canDetails'> | undefined): MenuGrants {
  if (!item) return closed;
  const canAdd = item.canAll || item.canAdd;
  const canDelete = item.canAll || item.canDelete;
  const canEdit = item.canAll || item.canEdit;
  const canDetails = item.canAll || item.canDetails;
  return {
    canAdd,
    canDelete,
    canEdit,
    canDetails,
    canOpen: canAdd || canDelete || canEdit || canDetails,
  };
}

export function useMenuAccess(url: string) {
  const access = useAppSelector((state) => state.menus.access);
  const status = useAppSelector((state) => state.menus.accessStatus);
  const item = access.find((menu) => menu.url === url);
  return { ...menuGrants(item), status };
}
