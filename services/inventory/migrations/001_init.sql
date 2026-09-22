CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS reservations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL UNIQUE,machine_id uuid NOT NULL,start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,duration_minutes integer NOT NULL,status text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS processed_events(event_id uuid PRIMARY KEY,processed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS outbox(event_id uuid PRIMARY KEY,topic text NOT NULL,payload jsonb NOT NULL,published_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox(created_at) WHERE published_at IS NULL;
