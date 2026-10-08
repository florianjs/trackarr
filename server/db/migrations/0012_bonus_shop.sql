-- Bonus points, shop & bounties (issue #48)
ALTER TABLE "users" ADD COLUMN "bonus_points" double precision DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN "avatar_url" text;
ALTER TABLE "users" ADD COLUMN "can_use_gif_avatar" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "bonus_transactions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" double precision NOT NULL,
  "type" text NOT NULL,
  "description" text,
  "ref_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "bonus_tx_user_idx" ON "bonus_transactions" ("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "shop_items" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "type" text NOT NULL,
  "price" integer NOT NULL,
  "value" bigint DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bounties" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "description" text,
  "imdb_id" text,
  "category_id" text REFERENCES "categories"("id") ON DELETE SET NULL,
  "requester_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'open' NOT NULL,
  "total_points" double precision DEFAULT 0 NOT NULL,
  "filled_torrent_id" text REFERENCES "torrents"("id") ON DELETE SET NULL,
  "filled_by_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "claimed_at" timestamp,
  "filled_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "bounties_status_idx" ON "bounties" ("status", "created_at");

CREATE TABLE IF NOT EXISTS "bounty_contributions" (
  "id" text PRIMARY KEY,
  "bounty_id" text NOT NULL REFERENCES "bounties"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" double precision NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "bounty_contrib_bounty_idx" ON "bounty_contributions" ("bounty_id");
