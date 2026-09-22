CREATE OR REPLACE FUNCTION dbo.update_user_group(
  p_id UUID,
  p_group_name VARCHAR(100) DEFAULT NULL,
  p_sys_admin BOOLEAN DEFAULT NULL,
  p_status INTEGER DEFAULT NULL,
  p_updated_by INTEGER DEFAULT NULL
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
  UPDATE dbo.user_groups AS g
  SET group_name = COALESCE(p_group_name, g.group_name),
      sys_admin = COALESCE(p_sys_admin, g.sys_admin),
      status = COALESCE(p_status, g.status),
      updated_at = dbo.get_date(),
      updated_by = p_updated_by
  WHERE g.id = p_id
  RETURNING
    g.id, g.group_name, g.sys_admin, g.status, g.created_at, g.created_by,
    g.updated_at, g.updated_by,
    dbo.get_fromated_datetime(g.created_at),
    dbo.get_fromated_datetime(g.updated_at),
    dbo.get_user_name(g.created_by::TEXT),
    dbo.get_user_name(g.updated_by::TEXT);
$$;
