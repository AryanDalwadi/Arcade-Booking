USE arcade_booking;
GO

CREATE OR ALTER PROCEDURE dbo.Get_User_By_Email
  @email NVARCHAR(255)
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    id,
    name,
    email,
    password_hash,
    created_at,
    created_by,
    updated_at,
    updated_by
  FROM dbo.users
  WHERE email = @email;
END
GO
