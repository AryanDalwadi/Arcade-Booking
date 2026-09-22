CREATE OR REPLACE FUNCTION dbo.get_user(
  p_name VARCHAR(100) DEFAULT '',
  p_email VARCHAR(255) DEFAULT '',
  p_page_size INTEGER DEFAULT 20,
  p_current_page INTEGER DEFAULT 1
)
RETURNS TABLE (
  sr_no BIGINT,
  id INTEGER,
  name VARCHAR(100),
  email VARCHAR(255),
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
      row_number() OVER (ORDER BY u.created_at DESC, u.id DESC) AS sr_no,
      u.*,
      count(*) OVER () AS total_count
    FROM dbo.users u
    WHERE (COALESCE(p_name, '') = '' OR u.name ILIKE '%' || p_name || '%')
      AND (COALESCE(p_email, '') = '' OR u.email ILIKE '%' || p_email || '%')
  )
  SELECT
    f.sr_no,
    f.id,
    f.name,
    f.email,
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
