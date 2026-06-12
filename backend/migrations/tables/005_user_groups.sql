USE arcade_booking;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_groups' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.user_groups (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_user_groups_id DEFAULT NEWID(),
    group_name NVARCHAR(100) NOT NULL,
    sys_admin BIT NOT NULL CONSTRAINT DF_user_groups_sys_admin DEFAULT 0,
    status INT NOT NULL CONSTRAINT DF_user_groups_status DEFAULT 1,
    created_at DATETIME NOT NULL CONSTRAINT DF_user_groups_created_at DEFAULT (dbo.get_date()),
    created_by INT NULL,
    updated_at DATETIME NULL,
    updated_by INT NULL,
    CONSTRAINT PK_user_groups PRIMARY KEY (id),
    CONSTRAINT UQ_user_groups_group_name UNIQUE (group_name)
  );
END
GO
