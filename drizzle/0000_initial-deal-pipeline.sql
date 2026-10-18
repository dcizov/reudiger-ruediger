CREATE TABLE "deal_of_the_day" (
	"game_id" text PRIMARY KEY NOT NULL,
	"claim_token" text,
	"claim_until" timestamp with time zone,
	"posted_at" timestamp with time zone,
	"cooldown_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "posted_deals" (
	"game_id" text NOT NULL,
	"shop_id" integer NOT NULL,
	"title" text NOT NULL,
	"shop_name" text NOT NULL,
	"url" text NOT NULL,
	"country" text NOT NULL,
	"currency" text NOT NULL,
	"current_price" double precision NOT NULL,
	"regular_price" double precision NOT NULL,
	"discount_percent" integer NOT NULL,
	"historical_low_price" double precision,
	"is_historical_low" boolean NOT NULL,
	"is_new_all_time_low" boolean NOT NULL,
	"score" double precision NOT NULL,
	"score_components" jsonb NOT NULL,
	"steam_app_id" integer NOT NULL,
	"steam_review_count" integer,
	"metacritic_score" integer,
	"expires_at" timestamp with time zone,
	"claim_token" text,
	"claim_until" timestamp with time zone,
	"message_id" text,
	"channel_id" text,
	"posted_at" timestamp with time zone,
	CONSTRAINT "posted_deals_game_id_shop_id_pk" PRIMARY KEY("game_id","shop_id")
);
--> statement-breakpoint
CREATE TABLE "steam_mappings" (
	"game_id" text PRIMARY KEY NOT NULL,
	"app_id" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steam_metadata_cache" (
	"app_id" integer PRIMARY KEY NOT NULL,
	"metadata" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deal_of_the_day_cooldown_idx" ON "deal_of_the_day" USING btree ("cooldown_until");--> statement-breakpoint
CREATE INDEX "posted_deals_posted_at_idx" ON "posted_deals" USING btree ("posted_at");