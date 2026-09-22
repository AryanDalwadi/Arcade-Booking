/*
  Standard audit columns for every table:

    created_at  TIMESTAMP NOT NULL DEFAULT dbo.get_date()
    created_by  INTEGER NULL
    updated_at  TIMESTAMP NULL
    updated_by  INTEGER NULL

  On INSERT: set created_at = dbo.get_date(), created_by = user_id
  On UPDATE: set updated_at = dbo.get_date(), updated_by = user_id
*/
