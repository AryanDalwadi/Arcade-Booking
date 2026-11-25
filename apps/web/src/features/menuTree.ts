export type TreeMenu = {
  id: string;
  parentId: string | null;
  label: string;
  priority: number;
};

export type MenuNode<T extends TreeMenu> = T & { children: MenuNode<T>[] };

export function menuIndex<T extends { id: string }>(menus: T[]): Map<string, T> {
  return new Map(menus.map((menu) => [menu.id, menu]));
}

export function rootOf<T extends { id: string; parentId: string | null }>(menu: T, byId: Map<string, T>): T {
  let current = menu;
  const seen = new Set<string>();
  while (current.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

export function isInBranch<T extends { id: string; parentId: string | null }>(
  menu: T,
  ancestorId: string,
  byId: Map<string, T>,
): boolean {
  if (menu.id === ancestorId) return true;
  let current = menu;
  const seen = new Set<string>();
  while (current.parentId && !seen.has(current.id)) {
    if (current.parentId === ancestorId) return true;
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) return false;
    current = parent;
  }
  return false;
}

export function descendantIds<T extends { id: string; parentId: string | null }>(id: string, menus: T[]): string[] {
  return menus
    .filter((menu) => menu.parentId === id)
    .flatMap((menu) => [menu.id, ...descendantIds(menu.id, menus)]);
}

export function buildMenuTree<T extends TreeMenu>(menus: T[]): MenuNode<T>[] {
  const nodes = new Map<string, MenuNode<T>>(menus.map((menu) => [menu.id, { ...menu, children: [] }]));
  const roots: MenuNode<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: MenuNode<T>[]) => {
    list.sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label));
    list.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}
