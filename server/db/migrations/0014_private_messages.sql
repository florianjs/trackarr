-- Private messages between members
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text PRIMARY KEY,
  "pair_key" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_message_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "conversation_members" (
  "conversation_id" text NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "last_read_at" timestamp,
  "hidden_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_members_pk" ON "conversation_members" ("conversation_id", "user_id");
CREATE INDEX IF NOT EXISTS "conversation_members_user_idx" ON "conversation_members" ("user_id");
CREATE TABLE IF NOT EXISTS "private_messages" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "sender_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "private_messages_conv_idx" ON "private_messages" ("conversation_id", "created_at");
CREATE TABLE IF NOT EXISTS "user_blocks" (
  "blocker_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "blocked_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_blocks_pk" ON "user_blocks" ("blocker_id", "blocked_id");
