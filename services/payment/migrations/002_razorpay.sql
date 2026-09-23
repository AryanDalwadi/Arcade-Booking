ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE payments ADD CONSTRAINT payments_provider_check CHECK (provider IN ('SIMULATED', 'RAZORPAY'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_order_id text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_order_uidx ON payments (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_booking_id_idx ON payments (booking_id);
