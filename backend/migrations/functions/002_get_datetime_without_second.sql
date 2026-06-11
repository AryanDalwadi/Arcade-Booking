USE arcade_booking;
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER FUNCTION dbo.get_datetime_without_second(@in_time DATETIME)
RETURNS DATETIME
AS
BEGIN
  DECLARE @out_time DATETIME = @in_time;

  IF @out_time IS NULL
  BEGIN
    RETURN NULL;
  END

  SET @out_time = DATEADD(MILLISECOND, -1 * DATEPART(MILLISECOND, @out_time), @out_time);
  SET @out_time = DATEADD(SECOND, -1 * DATEPART(SECOND, @out_time), @out_time);

  RETURN @out_time;
END
GO
