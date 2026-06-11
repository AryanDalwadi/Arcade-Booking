USE arcade_booking;
GO

CREATE OR ALTER PROCEDURE dbo.Create_User
  @name NVARCHAR(100),
  @email NVARCHAR(255),
  @password_hash NVARCHAR(255),
  @created_by INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO dbo.users (name, email, password_hash, created_at, created_by)
  VALUES (@name, @email, @password_hash, dbo.get_date(), @created_by);

  SELECT
    id,
    name,
    email,
    created_at,
    created_by,
    updated_at,
    updated_by
  FROM dbo.users
  WHERE id = SCOPE_IDENTITY();
END
GO
