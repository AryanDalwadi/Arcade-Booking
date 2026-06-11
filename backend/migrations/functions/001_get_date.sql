USE arcade_booking;
GO

DECLARE @default_name NVARCHAR(200);

IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
BEGIN
  SELECT @default_name = default_constraints.name
  FROM sys.default_constraints
  INNER JOIN sys.columns
    ON columns.object_id = default_constraints.parent_object_id
    AND columns.column_id = default_constraints.parent_column_id
  WHERE default_constraints.parent_object_id = OBJECT_ID('dbo.users')
    AND columns.name = 'created_at';

  IF @default_name IS NOT NULL
  BEGIN
    EXEC('ALTER TABLE dbo.users DROP CONSTRAINT ' + @default_name);
  END
END
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER FUNCTION dbo.get_date()
RETURNS DATETIME
AS
BEGIN
  DECLARE @datetime DATETIME;
  SELECT @datetime = CONVERT(DATETIME, SWITCHOFFSET(SYSDATETIMEOFFSET(), '+05:30'));
  RETURN @datetime;
END
GO

IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
AND COL_LENGTH('dbo.users', 'created_at') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.default_constraints
  INNER JOIN sys.columns
    ON columns.object_id = default_constraints.parent_object_id
    AND columns.column_id = default_constraints.parent_column_id
  WHERE default_constraints.parent_object_id = OBJECT_ID('dbo.users')
    AND columns.name = 'created_at'
)
BEGIN
  ALTER TABLE dbo.users
  ADD CONSTRAINT DF_users_created_at DEFAULT (dbo.get_date()) FOR created_at;
END
GO
