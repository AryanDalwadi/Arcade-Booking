CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL UNIQUE,event_type text NOT NULL,channel text NOT NULL,recipient text NOT NULL,status text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
