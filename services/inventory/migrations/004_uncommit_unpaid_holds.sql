UPDATE reservations
SET committed = false
WHERE status = 'RESERVED' AND hold_expires_at IS NOT NULL;

UPDATE reservations
SET status = 'RELEASED', committed = false, hold_expires_at = NULL
WHERE status = 'RESERVED' AND hold_expires_at IS NOT NULL AND hold_expires_at < now();
