USE arcade_booking;
GO

IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
AND COL_LENGTH('dbo.users', 'created_by') IS NULL
BEGIN
  ALTER TABLE dbo.users ADD created_by INT NULL;
END
GO

IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
AND COL_LENGTH('dbo.users', 'updated_at') IS NULL
BEGIN
  ALTER TABLE dbo.users ADD updated_at DATETIME NULL;
END
GO

IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
AND COL_LENGTH('dbo.users', 'updated_by') IS NULL
BEGIN
  ALTER TABLE dbo.users ADD updated_by INT NULL;
END
GO
