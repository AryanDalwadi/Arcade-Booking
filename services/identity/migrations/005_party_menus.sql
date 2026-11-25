INSERT INTO menus (id, label, icon, url, priority, active, expandable, sys_admin)
VALUES
  ('a1000000-0000-4000-8000-000000000009', 'Venues', '⌂', '/admin/venues', 9, true, false, true),
  ('a1000000-0000-4000-8000-00000000000a', 'Party types', '★', '/admin/party-types', 10, true, false, true),
  ('a1000000-0000-4000-8000-00000000000b', 'Inclusions', '☑', '/admin/inclusions', 11, true, false, true),
  ('a1000000-0000-4000-8000-00000000000c', 'Package defaults', '▣', '/admin/package-defaults', 12, true, false, true),
  ('a1000000-0000-4000-8000-00000000000d', 'Booking rules', '◷', '/admin/booking-rules', 13, true, false, true)
ON CONFLICT (id) DO NOTHING;
