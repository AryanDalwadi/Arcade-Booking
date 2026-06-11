USE arcade_booking;
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.Update_User
  @id INT,
  @name NVARCHAR(100) = NULL,
  @email NVARCHAR(255) = NULL,
  @password_hash NVARCHAR(255) = NULL,
  @updated_by INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @id)
  BEGIN
    RAISERROR('User not found', 16, 1);
    RETURN;
  END

  UPDATE dbo.users
  SET
    name = COALESCE(@name, name),
    email = COALESCE(@email, email),
    password_hash = COALESCE(@password_hash, password_hash),
    updated_at = dbo.get_date(),
    updated_by = @updated_by
  WHERE id = @id;

  SELECT
    id,
    name,
    email,
    created_at,
    created_by,
    updated_at,
    updated_by,
    dbo.get_fromated_datetime(created_at) AS created_at_formatted,
    dbo.get_fromated_datetime(updated_at) AS updated_at_formatted,
    dbo.get_user_name(CAST(created_by AS NVARCHAR(50))) AS created_by_val,
    dbo.get_user_name(CAST(updated_by AS NVARCHAR(50))) AS updated_by_val
  FROM dbo.users
  WHERE id = @id;
END
GO
