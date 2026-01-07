-- Add is_banned and last_ip to users table
ALTER TABLE "users" ADD COLUMN "is_banned" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "last_ip" text;

-- Create banned_ips table
CREATE TABLE IF NOT EXISTS "banned_ips" (
	"ip" text PRIMARY KEY NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
