USE arcade_booking;
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.Update_User_Group
  @id UNIQUEIDENTIFIER,
  @group_name NVARCHAR(100) = NULL,
  @sys_admin BIT = NULL,
  @status INT = NULL,
  @updated_by INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.user_groups WHERE id = @id)
  BEGIN
    RAISERROR('User group not found', 16, 1);
    RETURN;
  END

  UPDATE dbo.user_groups
  SET
    group_name = COALESCE(@group_name, group_name),
    sys_admin = COALESCE(@sys_admin, sys_admin),
    status = COALESCE(@status, status),
    updated_at = dbo.get_date(),
    updated_by = @updated_by
  WHERE id = @id;

  SELECT
    id,
    group_name,
    sys_admin,
    status,
    created_at,
    created_by,
    updated_at,
    updated_by,
    dbo.get_fromated_datetime(created_at) AS created_at_formatted,
    dbo.get_fromated_datetime(updated_at) AS updated_at_formatted,
    dbo.get_user_name(CAST(created_by AS NVARCHAR(50))) AS created_by_val,
    dbo.get_user_name(CAST(updated_by AS NVARCHAR(50))) AS updated_by_val
  FROM dbo.user_groups
  WHERE id = @id;
END
GO
