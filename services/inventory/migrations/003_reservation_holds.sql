ALTER TABLE reservations ADD COLUMN IF NOT EXISTS committed boolean NOT NULL DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;
UPDATE reservations SET committed = true WHERE committed = false;
