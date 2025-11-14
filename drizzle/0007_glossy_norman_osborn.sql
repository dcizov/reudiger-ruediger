CREATE TABLE "steam_app_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"header_image" text,
	"short_description" text,
	"developers" text,
	"publishers" text,
	"release_date" text,
	"is_free" boolean,
	"metacritic_score" integer,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "steam_app_cache_app_id_unique" UNIQUE("app_id")
);
--> statement-breakpoint
CREATE TABLE "steam_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_user_id" varchar(64) NOT NULL,
	"steam_id" varchar(64) NOT NULL,
	"persona_name" text,
	"profile_url" text,
	"avatar" text,
	"is_public" boolean DEFAULT false,
	"last_synced" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "steam_profiles_discord_user_id_unique" UNIQUE("discord_user_id"),
	CONSTRAINT "steam_profiles_steam_id_unique" UNIQUE("steam_id")
);
--> statement-breakpoint
CREATE TABLE "steam_wishlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"steam_app_id" integer NOT NULL,
	"game_name" text NOT NULL,
	"added_price" integer,
	"target_price" integer,
	"notified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "steam_app_id" integer;--> statement-breakpoint
CREATE INDEX "steam_app_cache_name_idx" ON "steam_app_cache" USING btree ("name");--> statement-breakpoint
CREATE INDEX "steam_app_cache_last_updated_idx" ON "steam_app_cache" USING btree ("last_updated");--> statement-breakpoint
CREATE INDEX "steam_profiles_discord_user_idx" ON "steam_profiles" USING btree ("discord_user_id");--> statement-breakpoint
CREATE INDEX "steam_profiles_steam_id_idx" ON "steam_profiles" USING btree ("steam_id");--> statement-breakpoint
CREATE INDEX "steam_wishlists_user_id_idx" ON "steam_wishlists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "steam_wishlists_steam_app_id_idx" ON "steam_wishlists" USING btree ("steam_app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "steam_wishlists_user_app_unique" ON "steam_wishlists" USING btree ("user_id","steam_app_id");