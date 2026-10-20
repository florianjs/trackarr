-- Torznab API key, separate from the announce passkey
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "api_key" text;
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_api_key_unique" UNIQUE ("api_key");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
