-- Rename ip column to ip_hash for privacy
-- This migration changes raw IP storage to hashed IP storage

ALTER TABLE announce_log RENAME COLUMN ip TO ip_hash;

-- Add comment explaining the column
COMMENT ON COLUMN announce_log.ip_hash IS 'SHA256 hash of client IP (first 16 chars). Rotates daily for privacy.';
