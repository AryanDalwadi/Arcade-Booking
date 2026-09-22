CREATE TABLE IF NOT EXISTS event_facts(event_id uuid PRIMARY KEY,event_type text NOT NULL,occurred_at timestamptz NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS processed_events(event_id uuid PRIMARY KEY,processed_at timestamptz NOT NULL DEFAULT now());
