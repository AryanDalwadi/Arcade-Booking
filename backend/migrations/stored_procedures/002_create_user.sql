CREATE OR REPLACE FUNCTION dbo.create_user(
  p_name VARCHAR(100),
  p_email VARCHAR(255),
  p_password_hash VARCHAR(255),
  p_created_by INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  name VARCHAR(100),
  email VARCHAR(255),
  created_at TIMESTAMP,
  created_by INTEGER,
  updated_at TIMESTAMP,
  updated_by INTEGER
)
LANGUAGE sql
VOLATILE
AS $$
  INSERT INTO dbo.users AS u (name, email, password_hash, created_at, created_by)
  VALUES (p_name, p_email, p_password_hash, dbo.get_date(), p_created_by)
  RETURNING u.id, u.name, u.email, u.created_at, u.created_by, u.updated_at, u.updated_by;
$$;
