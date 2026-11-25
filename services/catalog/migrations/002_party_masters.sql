CREATE TABLE IF NOT EXISTS party_types (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code IN ('BIRTHDAY', 'SCHOOL', 'WORK')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS package_templates (
  code text PRIMARY KEY CHECK (code IN ('LITE', 'CLASSIC', 'PREMIUM')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_per_person_cents integer NOT NULL CHECK (price_per_person_cents >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  min_guests integer NOT NULL DEFAULT 10 CHECK (min_guests > 0),
  max_guests integer NOT NULL DEFAULT 50 CHECK (max_guests >= min_guests),
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS package_template_inclusions (
  template_code text NOT NULL REFERENCES package_templates(code) ON DELETE CASCADE,
  inclusion_id uuid NOT NULL REFERENCES inclusions(id) ON DELETE CASCADE,
  PRIMARY KEY (template_code, inclusion_id)
);

CREATE TABLE IF NOT EXISTS venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  city text NOT NULL DEFAULT '',
  mall text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venue_party_types (
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  party_type_id uuid NOT NULL REFERENCES party_types(id) ON DELETE CASCADE,
  PRIMARY KEY (venue_id, party_type_id)
);

CREATE TABLE IF NOT EXISTS venue_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code IN ('LITE', 'CLASSIC', 'PREMIUM')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_per_person_cents integer NOT NULL CHECK (price_per_person_cents >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  min_guests integer NOT NULL CHECK (min_guests > 0),
  max_guests integer NOT NULL CHECK (max_guests >= min_guests),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (venue_id, code)
);

CREATE TABLE IF NOT EXISTS venue_package_inclusions (
  venue_package_id uuid NOT NULL REFERENCES venue_packages(id) ON DELETE CASCADE,
  inclusion_id uuid NOT NULL REFERENCES inclusions(id) ON DELETE CASCADE,
  PRIMARY KEY (venue_package_id, inclusion_id)
);

CREATE TABLE IF NOT EXISTS party_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venue_hours (
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at time NOT NULL,
  closes_at time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 60 CHECK (slot_minutes > 0),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (venue_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS venue_blackouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  blackout_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  UNIQUE (venue_id, blackout_date)
);

CREATE TABLE IF NOT EXISTS booking_rules (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  hold_minutes integer NOT NULL DEFAULT 10 CHECK (hold_minutes > 0),
  min_guests integer NOT NULL DEFAULT 10 CHECK (min_guests > 0),
  slot_minutes integer NOT NULL DEFAULT 60 CHECK (slot_minutes > 0),
  refund_policy text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO party_types (id, code, title, description, sort_order)
VALUES
  ('b1000000-0000-4000-8000-000000000001', 'BIRTHDAY', 'Birthday party', 'A hosted birthday with arcade play, a private party space, and a package built around the guest of honour.', 1),
  ('b1000000-0000-4000-8000-000000000002', 'SCHOOL', 'School trips', 'A school outing with timed arcade play, hosts, and a package priced per student.', 2),
  ('b1000000-0000-4000-8000-000000000003', 'WORK', 'Work parties', 'A team celebration with arcade play, a private space, and a package priced per person.', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO inclusions (id, name, description, sort_order)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'Arcade play', 'Timed play on the arcade floor', 1),
  ('c1000000-0000-4000-8000-000000000002', 'Party host', 'A host for setup, the party, and cleanup', 2),
  ('c1000000-0000-4000-8000-000000000003', 'Decorations', 'Party decorations in the booked room', 3),
  ('c1000000-0000-4000-8000-000000000004', 'Private room', 'A private party room for the booking', 4),
  ('c1000000-0000-4000-8000-000000000005', 'Food and drinks', 'Food and drinks for the party size', 5),
  ('c1000000-0000-4000-8000-000000000006', 'Bowling', 'Bowling during the booked hour', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO package_templates (
  code, name, description, price_per_person_cents, currency, min_guests, max_guests, duration_minutes, sort_order
) VALUES
  ('LITE', 'Lite', 'Arcade play with a party host for a simple celebration.', 49900, 'INR', 10, 40, 60, 1),
  ('CLASSIC', 'Classic', 'Arcade play, decorations, a host, and food for a fuller party.', 79900, 'INR', 10, 60, 60, 2),
  ('PREMIUM', 'Premium', 'The full celebration: private room, host, decorations, food, arcade play, and bowling.', 119900, 'INR', 10, 80, 60, 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO package_template_inclusions (template_code, inclusion_id)
VALUES
  ('LITE', 'c1000000-0000-4000-8000-000000000001'),
  ('LITE', 'c1000000-0000-4000-8000-000000000002'),
  ('CLASSIC', 'c1000000-0000-4000-8000-000000000001'),
  ('CLASSIC', 'c1000000-0000-4000-8000-000000000002'),
  ('CLASSIC', 'c1000000-0000-4000-8000-000000000003'),
  ('CLASSIC', 'c1000000-0000-4000-8000-000000000005'),
  ('PREMIUM', 'c1000000-0000-4000-8000-000000000001'),
  ('PREMIUM', 'c1000000-0000-4000-8000-000000000002'),
  ('PREMIUM', 'c1000000-0000-4000-8000-000000000003'),
  ('PREMIUM', 'c1000000-0000-4000-8000-000000000004'),
  ('PREMIUM', 'c1000000-0000-4000-8000-000000000005'),
  ('PREMIUM', 'c1000000-0000-4000-8000-000000000006')
ON CONFLICT DO NOTHING;

INSERT INTO booking_rules (id, hold_minutes, min_guests, slot_minutes, refund_policy)
VALUES (
  true,
  10,
  10,
  60,
  'A full refund is available when the party is cancelled at least 48 hours before the start time. Cancellations inside 48 hours are not refunded. An unpaid booking hold lasts 10 minutes. When that time ends, the slot is released.'
)
ON CONFLICT (id) DO NOTHING;
