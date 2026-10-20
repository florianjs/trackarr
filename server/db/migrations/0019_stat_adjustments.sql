-- Admin corrections of uploaded/downloaded totals, with who and why
CREATE TABLE IF NOT EXISTS "stat_adjustments" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "admin_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "uploaded_delta" bigint NOT NULL,
  "downloaded_delta" bigint NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "stat_adjustments_user_idx" ON "stat_adjustments" ("user_id", "created_at");
