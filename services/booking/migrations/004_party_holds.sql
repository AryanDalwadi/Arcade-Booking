CREATE TABLE IF NOT EXISTS party_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  venue_id uuid NOT NULL,
  package_code text NOT NULL,
  guest_count integer NOT NULL CHECK (guest_count > 0),
  party_room_id uuid,
  start_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL,
  expires_at timestamptz NOT NULL,
  booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS party_holds_venue_start_idx ON party_holds (venue_id, start_at);
