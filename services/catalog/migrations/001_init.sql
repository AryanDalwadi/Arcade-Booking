CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS machines(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,status text NOT NULL CHECK(status IN ('ACTIVE','MAINTENANCE','RETIRED')),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS games(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,machine_id uuid NOT NULL REFERENCES machines(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS pricing(machine_id uuid PRIMARY KEY REFERENCES machines(id),price_per_hour_cents integer NOT NULL CHECK(price_per_hour_cents>=0),currency char(3) NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
