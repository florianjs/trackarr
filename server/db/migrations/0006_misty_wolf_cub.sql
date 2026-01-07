CREATE TABLE "hnr_tracking" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"torrent_id" text NOT NULL,
	"downloaded_at" timestamp DEFAULT now() NOT NULL,
	"seed_time" integer DEFAULT 0 NOT NULL,
	"required_seed_time" integer DEFAULT 86400 NOT NULL,
	"is_hnr" boolean DEFAULT false NOT NULL,
	"is_exempt" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_by" text NOT NULL,
	"used_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"used_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "panic_state" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"encrypted_at" timestamp,
	"encryption_salt" text,
	"encryption_iv" text
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"users_count" integer NOT NULL,
	"torrents_count" integer NOT NULL,
	"peers_count" integer NOT NULL,
	"seeders_count" integer NOT NULL,
	"redis_memory_usage" bigint NOT NULL,
	"db_size" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "torrent_tags" (
	"torrent_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT "categories_name_unique";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invites_remaining" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "panic_password_hash" text;--> statement-breakpoint
ALTER TABLE "hnr_tracking" ADD CONSTRAINT "hnr_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hnr_tracking" ADD CONSTRAINT "hnr_tracking_torrent_id_torrents_id_fk" FOREIGN KEY ("torrent_id") REFERENCES "public"."torrents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torrent_tags" ADD CONSTRAINT "torrent_tags_torrent_id_torrents_id_fk" FOREIGN KEY ("torrent_id") REFERENCES "public"."torrents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torrent_tags" ADD CONSTRAINT "torrent_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hnr_user_idx" ON "hnr_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "hnr_torrent_idx" ON "hnr_tracking" USING btree ("torrent_id");--> statement-breakpoint
CREATE INDEX "hnr_status_idx" ON "hnr_tracking" USING btree ("is_hnr");--> statement-breakpoint
CREATE UNIQUE INDEX "hnr_user_torrent_idx" ON "hnr_tracking" USING btree ("user_id","torrent_id");--> statement-breakpoint
CREATE INDEX "invitations_created_by_idx" ON "invitations" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "invitations_code_idx" ON "invitations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "site_stats_created_at_idx" ON "site_stats" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "torrent_tags_torrent_idx" ON "torrent_tags" USING btree ("torrent_id");--> statement-breakpoint
CREATE INDEX "torrent_tags_tag_idx" ON "torrent_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");