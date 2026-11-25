-- Multi-account guard: accounts sharing an IP are held until staff review an appeal
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ip_hold" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ip_exempt" boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS "users_last_ip_idx" ON "users" ("last_ip");
CREATE TABLE IF NOT EXISTS "ip_appeals" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "staff_note" text,
  "reviewed_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ip_appeals_user_idx" ON "ip_appeals" ("user_id", "created_at");
