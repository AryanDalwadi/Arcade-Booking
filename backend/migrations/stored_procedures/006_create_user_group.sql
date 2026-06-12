USE arcade_booking;
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.Create_User_Group
  @group_name NVARCHAR(100),
  @sys_admin BIT,
  @status INT,
  @created_by INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @new_id UNIQUEIDENTIFIER = NEWID();

  INSERT INTO dbo.user_groups (id, group_name, sys_admin, status, created_at, created_by)
  VALUES (@new_id, @group_name, @sys_admin, @status, dbo.get_date(), @created_by);

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
  WHERE id = @new_id;
END
GO
