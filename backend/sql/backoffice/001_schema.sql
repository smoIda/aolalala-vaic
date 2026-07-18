CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  external_ref TEXT UNIQUE,
  source TEXT NOT NULL DEFAULT 'chatbot',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  ticket_type TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  patient_name TEXT,
  patient_phone TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
CREATE INDEX IF NOT EXISTS tickets_priority_idx ON tickets(priority);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'chatbot',
  status TEXT NOT NULL DEFAULT 'requested',
  patient_name TEXT,
  patient_phone TEXT,
  department TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_touch_updated_at ON tickets;
CREATE TRIGGER tickets_touch_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS bookings_touch_updated_at ON bookings;
CREATE TRIGGER bookings_touch_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
