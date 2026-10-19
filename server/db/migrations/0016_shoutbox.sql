-- Shoutbox: channels, messages, emoji reactions and mutes
CREATE TABLE IF NOT EXISTS "shout_channels" (
  "id" text PRIMARY KEY,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "position" integer DEFAULT 0 NOT NULL,
  "read_access" text DEFAULT 'all' NOT NULL,
  "role_ids" text[] DEFAULT '{}'::text[] NOT NULL,
  "write_access" text DEFAULT 'members' NOT NULL,
  "reactions_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "shout_messages" (
  "id" text PRIMARY KEY,
  "channel_id" text NOT NULL REFERENCES "shout_channels"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  "deleted_by" text
);
CREATE INDEX IF NOT EXISTS "shout_messages_channel_idx" ON "shout_messages" ("channel_id", "created_at");
CREATE TABLE IF NOT EXISTS "shout_reactions" (
  "message_id" text NOT NULL REFERENCES "shout_messages"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "emoji" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "shout_reactions_pk" ON "shout_reactions" ("message_id", "user_id", "emoji");
CREATE TABLE IF NOT EXISTS "shout_mutes" (
  "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "until" timestamp NOT NULL,
  "reason" text,
  "muted_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
