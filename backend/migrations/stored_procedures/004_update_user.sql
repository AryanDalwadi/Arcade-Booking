CREATE OR REPLACE FUNCTION dbo.update_user(
  p_id INTEGER,
  p_name VARCHAR(100) DEFAULT NULL,
  p_email VARCHAR(255) DEFAULT NULL,
  p_password_hash VARCHAR(255) DEFAULT NULL,
  p_updated_by INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  name VARCHAR(100),
  email VARCHAR(255),
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
  UPDATE dbo.users AS u
  SET name = COALESCE(p_name, u.name),
      email = COALESCE(p_email, u.email),
      password_hash = COALESCE(p_password_hash, u.password_hash),
      updated_at = dbo.get_date(),
      updated_by = p_updated_by
  WHERE u.id = p_id
  RETURNING
    u.id, u.name, u.email, u.created_at, u.created_by, u.updated_at, u.updated_by,
    dbo.get_fromated_datetime(u.created_at),
    dbo.get_fromated_datetime(u.updated_at),
    dbo.get_user_name(u.created_by::TEXT),
    dbo.get_user_name(u.updated_by::TEXT);
$$;
