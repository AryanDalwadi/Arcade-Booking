USE arcade_booking;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    email NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL CONSTRAINT DF_users_created_at DEFAULT (dbo.get_date()),
    created_by INT NULL,
    updated_at DATETIME NULL,
    updated_by INT NULL
  );
END
GO
