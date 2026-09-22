CREATE OR REPLACE FUNCTION dbo.create_user_group(
  p_group_name VARCHAR(100),
  p_sys_admin BOOLEAN,
  p_status INTEGER,
  p_created_by INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  group_name VARCHAR(100),
  sys_admin BOOLEAN,
  status INTEGER,
  created_at TIMESTAMP,
  created_by INTEGER,
  updated_at TIMESTAMP,
  updated_by INTEGER,
  created_at_formatted VARCHAR(50),
  updated_at_formatted VARCHAR(50),
  created_by_val VARCHAR(100),
  updated_by_val VARCHAR(100)
)
LANGUAGE sql
VOLATILE
AS $$
  INSERT INTO dbo.user_groups AS g
    (group_name, sys_admin, status, created_at, created_by)
  VALUES (p_group_name, p_sys_admin, p_status, dbo.get_date(), p_created_by)
  RETURNING
    g.id, g.group_name, g.sys_admin, g.status, g.created_at, g.created_by,
    g.updated_at, g.updated_by,
    dbo.get_fromated_datetime(g.created_at),
    dbo.get_fromated_datetime(g.updated_at),
    dbo.get_user_name(g.created_by::TEXT),
    dbo.get_user_name(g.updated_by::TEXT);
$$;
