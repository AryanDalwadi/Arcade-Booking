CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL,amount_cents integer NOT NULL,currency char(3) NOT NULL,idempotency_key text NOT NULL UNIQUE,status text NOT NULL,provider text NOT NULL CHECK(provider='SIMULATED'),provider_reference text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS outbox(event_id uuid PRIMARY KEY,topic text NOT NULL,payload jsonb NOT NULL,published_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
