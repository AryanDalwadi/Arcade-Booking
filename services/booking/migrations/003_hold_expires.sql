ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;
