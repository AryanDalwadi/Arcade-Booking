USE arcade_booking;
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER FUNCTION dbo.get_fromated_date(@in_time DATETIME)
RETURNS NVARCHAR(50)
AS
BEGIN
  DECLARE @datetime NVARCHAR(50);

  IF @in_time IS NULL
  BEGIN
    SET @datetime = '';
  END
  ELSE
  BEGIN
    SET @datetime = FORMAT(@in_time, 'dd-MM-yyyy');
  END

  RETURN @datetime;
END
GO
