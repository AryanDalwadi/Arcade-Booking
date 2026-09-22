CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS end_at timestamptz;
UPDATE reservations
SET end_at = start_at + (duration_minutes || ' minutes')::interval
WHERE end_at IS NULL;
ALTER TABLE reservations ALTER COLUMN end_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_no_machine_overlap'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_no_machine_overlap
      EXCLUDE USING gist (
        machine_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (status = 'RESERVED');
  END IF;
END
$$;
