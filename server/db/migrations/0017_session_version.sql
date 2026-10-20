-- Server-side session revocation: sessions carry the version they were issued with
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 0 NOT NULL;
