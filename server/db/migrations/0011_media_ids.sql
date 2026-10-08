-- External media database IDs on torrents (issue #47)
ALTER TABLE "torrents" ADD COLUMN "imdb_id" text;
ALTER TABLE "torrents" ADD COLUMN "tmdb_id" integer;
ALTER TABLE "torrents" ADD COLUMN "tvdb_id" integer;
CREATE INDEX IF NOT EXISTS "torrents_imdb_idx" ON "torrents" ("imdb_id");
CREATE INDEX IF NOT EXISTS "torrents_tmdb_idx" ON "torrents" ("tmdb_id");
CREATE INDEX IF NOT EXISTS "torrents_tvdb_idx" ON "torrents" ("tvdb_id");
