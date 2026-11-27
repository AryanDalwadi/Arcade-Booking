ALTER TABLE bookings ALTER COLUMN machine_id DROP NOT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS venue_id uuid;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_code text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_count integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS party_room_id uuid;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_target_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_target_check CHECK (
  (machine_id IS NOT NULL AND venue_id IS NULL AND package_code IS NULL AND guest_count IS NULL)
  OR (
    machine_id IS NULL
    AND venue_id IS NOT NULL
    AND package_code IS NOT NULL
    AND guest_count IS NOT NULL
    AND guest_count > 0
  )
);
