/*
  Standard audit columns for every table:

    created_at  DATETIME NOT NULL DEFAULT (dbo.get_date())
    created_by  INT NULL
    updated_at  DATETIME NULL
    updated_by  INT NULL

  On INSERT: set created_at = dbo.get_date(), created_by = @user_id
  On UPDATE: set updated_at = dbo.get_date(), updated_by = @user_id
*/
