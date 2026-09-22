DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'dbo'
      AND table_name = 'user_groups'
      AND column_name = 'status'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE dbo.user_groups
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE INTEGER USING CASE WHEN status THEN 1 ELSE 2 END,
      ALTER COLUMN status SET DEFAULT 1,
      ALTER COLUMN status SET NOT NULL;
  END IF;
END
$$;
