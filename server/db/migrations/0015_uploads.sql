-- Uploaded images stored in the database so replication carries them to every node
CREATE TABLE IF NOT EXISTS "uploads" (
  "name" text PRIMARY KEY,
  "content_type" text NOT NULL,
  "data" bytea NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
