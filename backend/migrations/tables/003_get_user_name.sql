USE arcade_booking;
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER FUNCTION dbo.get_user_name(@user_id NVARCHAR(50))
RETURNS NVARCHAR(50)
AS
BEGIN
  DECLARE @user_name NVARCHAR(50);

  IF ISNULL(@user_id, '') = ''
  BEGIN
    SET @user_name = '';
  END
  ELSE
  BEGIN
    SELECT @user_name = ISNULL(name, '')
    FROM dbo.users
    WHERE id = TRY_CAST(@user_id AS INT);
  END

  RETURN @user_name;
END
GO
