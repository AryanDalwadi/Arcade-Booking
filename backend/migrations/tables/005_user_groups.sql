CREATE TABLE IF NOT EXISTS dbo.user_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name VARCHAR(100) NOT NULL UNIQUE,
  sys_admin BOOLEAN NOT NULL DEFAULT FALSE,
  status INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT dbo.get_date(),
  created_by INTEGER NULL,
  updated_at TIMESTAMP NULL,
  updated_by INTEGER NULL
);
