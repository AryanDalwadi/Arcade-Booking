CREATE TABLE IF NOT EXISTS menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES menus(id) ON DELETE CASCADE,
  label text NOT NULL,
  icon text NOT NULL,
  url text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expandable boolean NOT NULL DEFAULT false,
  sys_admin boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menus_parent_id_idx ON menus(parent_id);
CREATE INDEX IF NOT EXISTS menus_priority_idx ON menus(priority);

CREATE TABLE IF NOT EXISTS menu_rights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('ADMIN', 'STAFF', 'CUSTOMER')),
  can_all boolean NOT NULL DEFAULT false,
  can_add boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_details boolean NOT NULL DEFAULT false,
  UNIQUE (menu_id, role)
);

INSERT INTO menus (id, label, icon, url, priority, active, expandable, sys_admin)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'Admin Dashboard', '◫', '/admin/dashboard', 1, true, false, true),
  ('a1000000-0000-4000-8000-000000000002', 'Users', '◎', '/admin/users', 2, true, false, true),
  ('a1000000-0000-4000-8000-000000000003', 'User Groups', '◉', '/admin/user-groups', 3, true, false, true),
  ('a1000000-0000-4000-8000-000000000004', 'Catalog Management', '▦', '/admin/catalog', 4, true, false, true),
  ('a1000000-0000-4000-8000-000000000005', 'All Bookings', '◆', '/admin/bookings', 5, true, false, true),
  ('a1000000-0000-4000-8000-000000000006', 'Notifications', '✉', '/admin/notifications', 6, true, false, true),
  ('a1000000-0000-4000-8000-000000000007', 'Menus', '☰', '/admin/menus', 7, true, false, true),
  ('a1000000-0000-4000-8000-000000000008', 'Menu Rights', '⚑', '/admin/menu-rights', 8, true, false, true)
ON CONFLICT (id) DO NOTHING;
