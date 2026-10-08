-- Torrent lists and Torznab sort by creation date with a LIMIT
CREATE INDEX IF NOT EXISTS "torrents_created_idx" ON "torrents" ("created_at");
