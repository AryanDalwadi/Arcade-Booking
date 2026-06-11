USE arcade_booking;
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.Get_User
  @name NVARCHAR(100) = '',
  @email NVARCHAR(255) = '',
  @page_size INT = 20,
  @current_page INT = 1
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @total_count INT = 0;
  DECLARE @total_page INT = 0;

  DECLARE @out_summ TABLE (
    success INT,
    current_page INT,
    total_count INT,
    has_more BIT,
    page_size INT,
    total_page INT
  );

  DECLARE @out_raw TABLE (
    sr_no INT,
    id INT
  );

  DECLARE @out_filter TABLE (
    sr_no INT,
    id INT
  );

  DECLARE @out_data TABLE (
    sr_no INT,
    id INT,
    name NVARCHAR(100),
    email NVARCHAR(255),
    insert_by INT,
    insert_by_val NVARCHAR(100),
    insert_datetime NVARCHAR(50),
    update_by INT,
    update_by_val NVARCHAR(100),
    update_datetime NVARCHAR(50)
  );

  INSERT INTO @out_raw
  SELECT
    ROW_NUMBER() OVER (ORDER BY u.created_at DESC) AS sr_no,
    u.id
  FROM dbo.users u
  WHERE
    (ISNULL(@name, '') = '' OR u.name LIKE '%' + @name + '%')
    AND (ISNULL(@email, '') = '' OR u.email LIKE '%' + @email + '%')
  ORDER BY sr_no;

  SELECT
    @total_count = COUNT(*),
    @total_page = CEILING(CONVERT(NUMERIC(18, 2), COUNT(*)) / NULLIF(@page_size, 0))
  FROM (SELECT id FROM @out_raw) AS r;

  IF @page_size IS NULL OR @page_size < 1
    SET @page_size = 20;

  IF @current_page IS NULL OR @current_page < 1
    SET @current_page = 1;

  IF @total_page IS NULL
    SET @total_page = 0;

  INSERT INTO @out_filter
  SELECT *
  FROM @out_raw
  ORDER BY sr_no
  OFFSET (@current_page - 1) * @page_size ROWS
  FETCH NEXT @page_size ROWS ONLY;

  INSERT INTO @out_data
  SELECT
    ot.sr_no,
    u.id,
    u.name,
    u.email,
    u.created_by,
    dbo.get_user_name(CAST(u.created_by AS NVARCHAR(50))),
    dbo.get_fromated_datetime(u.created_at),
    u.updated_by,
    dbo.get_user_name(CAST(u.updated_by AS NVARCHAR(50))),
    dbo.get_fromated_datetime(u.updated_at)
  FROM @out_filter ot
  INNER JOIN dbo.users u ON u.id = ot.id
  ORDER BY ot.sr_no;

  INSERT INTO @out_summ
  SELECT
    1,
    @current_page,
    @total_count,
    CASE
      WHEN @total_count = 0 THEN 0
      WHEN @current_page = @total_page THEN 0
      ELSE 1
    END AS has_more,
    @page_size,
    @total_page;

  SELECT * FROM @out_summ;
  SELECT * FROM @out_data ORDER BY sr_no ASC;
END
GO
