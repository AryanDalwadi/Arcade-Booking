CREATE OR REPLACE FUNCTION dbo.get_user_group(
  p_group_name VARCHAR(100) DEFAULT '',
  p_status INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 20,
  p_current_page INTEGER DEFAULT 1
)
RETURNS TABLE (
  sr_no BIGINT,
  id UUID,
  group_name VARCHAR(100),
  sys_admin BOOLEAN,
  status INTEGER,
  insert_by INTEGER,
  insert_by_val VARCHAR(100),
  insert_datetime VARCHAR(50),
  update_by INTEGER,
  update_by_val VARCHAR(100),
  update_datetime VARCHAR(50),
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT
      row_number() OVER (ORDER BY g.created_at DESC, g.id DESC) AS sr_no,
      g.*,
      count(*) OVER () AS total_count
    FROM dbo.user_groups g
    WHERE (COALESCE(p_group_name, '') = ''
           OR g.group_name ILIKE '%' || p_group_name || '%')
      AND (COALESCE(p_status, 0) = 0 OR g.status = p_status)
  )
  SELECT
    f.sr_no,
    f.id,
    f.group_name,
    f.sys_admin,
    f.status,
    f.created_by,
    dbo.get_user_name(f.created_by::TEXT),
    dbo.get_fromated_datetime(f.created_at),
    f.updated_by,
    dbo.get_user_name(f.updated_by::TEXT),
    dbo.get_fromated_datetime(f.updated_at),
    f.total_count
  FROM filtered f
  ORDER BY f.sr_no
  LIMIT GREATEST(COALESCE(p_page_size, 20), 1)
  OFFSET (GREATEST(COALESCE(p_current_page, 1), 1) - 1)
         * GREATEST(COALESCE(p_page_size, 20), 1);
$$;
