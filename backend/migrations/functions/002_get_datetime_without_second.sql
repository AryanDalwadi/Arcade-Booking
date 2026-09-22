CREATE OR REPLACE FUNCTION dbo.get_datetime_without_second(in_time TIMESTAMP)
RETURNS TIMESTAMP
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT date_trunc('minute', in_time);
$$;
