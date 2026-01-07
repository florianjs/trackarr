CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "torrents_name_trgm_idx" ON "torrents" USING gist ("name" gist_trgm_ops);
