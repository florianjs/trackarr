-- Add invites_remaining column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS invites_remaining INTEGER DEFAULT 0 NOT NULL;

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6b7280' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Torrent tags junction table
CREATE TABLE IF NOT EXISTS torrent_tags (
  torrent_id TEXT NOT NULL REFERENCES torrents(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (torrent_id, tag_id)
);
CREATE INDEX IF NOT EXISTS torrent_tags_torrent_idx ON torrent_tags(torrent_id);
CREATE INDEX IF NOT EXISTS torrent_tags_tag_idx ON torrent_tags(tag_id);

-- Hit and Run tracking
CREATE TABLE IF NOT EXISTS hnr_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  torrent_id TEXT NOT NULL REFERENCES torrents(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMP DEFAULT NOW() NOT NULL,
  seed_time INTEGER DEFAULT 0 NOT NULL,
  required_seed_time INTEGER DEFAULT 86400 NOT NULL,
  is_hnr BOOLEAN DEFAULT FALSE NOT NULL,
  is_exempt BOOLEAN DEFAULT FALSE NOT NULL,
  completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS hnr_user_idx ON hnr_tracking(user_id);
CREATE INDEX IF NOT EXISTS hnr_torrent_idx ON hnr_tracking(torrent_id);
CREATE INDEX IF NOT EXISTS hnr_status_idx ON hnr_tracking(is_hnr);
CREATE UNIQUE INDEX IF NOT EXISTS hnr_user_torrent_idx ON hnr_tracking(user_id, torrent_id);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  used_at TIMESTAMP,
  expires_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS invitations_created_by_idx ON invitations(created_by);
CREATE INDEX IF NOT EXISTS invitations_code_idx ON invitations(code);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  resolved_by TEXT REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS reports_target_idx ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);

-- Insert default HnR settings
INSERT INTO settings (key, value, updated_at) VALUES 
  ('hnr_enabled', 'true', NOW()),
  ('hnr_required_seed_time', '86400', NOW()),
  ('hnr_grace_period', '259200', NOW()),
  ('invite_enabled', 'true', NOW()),
  ('default_invites', '2', NOW())
ON CONFLICT (key) DO NOTHING;

-- Seed default tags
INSERT INTO tags (id, name, slug, color) VALUES
  ('tag-1080p', '1080p', '1080p', '#22c55e'),
  ('tag-720p', '720p', '720p', '#3b82f6'),
  ('tag-4k', '4K', '4k', '#a855f7'),
  ('tag-hdr', 'HDR', 'hdr', '#f59e0b'),
  ('tag-x264', 'x264', 'x264', '#6b7280'),
  ('tag-x265', 'x265', 'x265', '#6b7280'),
  ('tag-hevc', 'HEVC', 'hevc', '#6b7280'),
  ('tag-bluray', 'BluRay', 'bluray', '#3b82f6'),
  ('tag-web', 'WEB', 'web', '#10b981'),
  ('tag-remux', 'REMUX', 'remux', '#ec4899'),
  ('tag-freeleech', 'Freeleech', 'freeleech', '#22c55e'),
  ('tag-internal', 'Internal', 'internal', '#f59e0b')
ON CONFLICT (id) DO NOTHING;
