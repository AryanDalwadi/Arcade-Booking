ALTER TABLE user_groups
  ADD COLUMN IF NOT EXISTS system_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

UPDATE user_groups SET system_admin = true, active = true WHERE name = 'ADMIN';
UPDATE user_groups SET system_admin = false, active = true WHERE name IN ('CUSTOMER', 'STAFF');
