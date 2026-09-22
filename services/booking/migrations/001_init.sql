CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,machine_id uuid NOT NULL,start_at timestamptz NOT NULL,duration_minutes integer NOT NULL CHECK(duration_minutes>0),amount_cents integer NOT NULL CHECK(amount_cents>0),currency char(3) NOT NULL,status text NOT NULL,payment_status text NOT NULL DEFAULT 'PENDING',inventory_status text NOT NULL DEFAULT 'PENDING',created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'PENDING';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS inventory_status text NOT NULL DEFAULT 'PENDING';
CREATE TABLE IF NOT EXISTS outbox(event_id uuid PRIMARY KEY,topic text NOT NULL,payload jsonb NOT NULL,published_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox(created_at) WHERE published_at IS NULL;
