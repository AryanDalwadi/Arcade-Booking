USE arcade_booking;
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns c
  INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.user_groups')
    AND c.name = 'status'
    AND t.name = 'bit'
)
BEGIN
  DECLARE @constraint_name NVARCHAR(200);

  SELECT @constraint_name = dc.name
  FROM sys.default_constraints dc
  INNER JOIN sys.columns c
    ON dc.parent_object_id = c.object_id
    AND dc.parent_column_id = c.column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.user_groups')
    AND c.name = 'status';

  IF @constraint_name IS NOT NULL
  BEGIN
    EXEC('ALTER TABLE dbo.user_groups DROP CONSTRAINT [' + @constraint_name + ']');
  END
END
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns c
  INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.user_groups')
    AND c.name = 'status'
    AND t.name = 'bit'
)
BEGIN
  ALTER TABLE dbo.user_groups ADD status_int INT NULL;
END
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.user_groups')
    AND name = 'status_int'
)
BEGIN
  UPDATE dbo.user_groups
  SET status_int = CASE WHEN status = 1 THEN 1 ELSE 2 END;

  ALTER TABLE dbo.user_groups DROP COLUMN status;

  EXEC sp_rename 'dbo.user_groups.status_int', 'status', 'COLUMN';

  ALTER TABLE dbo.user_groups
  ADD CONSTRAINT DF_user_groups_status DEFAULT 1 FOR status;

  ALTER TABLE dbo.user_groups
  ALTER COLUMN status INT NOT NULL;
END
GO
