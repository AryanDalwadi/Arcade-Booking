CREATE OR REPLACE FUNCTION dbo.get_user_name(user_id TEXT)
RETURNS VARCHAR(100)
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN COALESCE(user_id, '') !~ '^[0-9]+$' THEN ''
    ELSE COALESCE(
      (SELECT u.name FROM dbo.users u WHERE u.id = user_id::INTEGER),
      ''
    )
  END;
$$;
