CREATE OR REPLACE FUNCTION dbo.get_user_by_login(p_login VARCHAR(255))
RETURNS TABLE (
  id INTEGER,
  name VARCHAR(100),
  email VARCHAR(255),
  password_hash VARCHAR(255),
  created_at TIMESTAMP,
  created_by INTEGER,
  updated_at TIMESTAMP,
  updated_by INTEGER
)
LANGUAGE sql
STABLE
AS $$
  SELECT u.id, u.name, u.email, u.password_hash,
         u.created_at, u.created_by, u.updated_at, u.updated_by
  FROM dbo.users u
  WHERE u.email ILIKE p_login OR u.name ILIKE p_login;
$$;
