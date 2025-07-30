CREATE TABLE "bot_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(64) NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bot_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "posted_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" varchar(64) NOT NULL,
	"message_id" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"store" text NOT NULL,
	"platform" text NOT NULL,
	"sale_price" varchar(32),
	"normal_price" varchar(32),
	"savings" varchar(16),
	"deal_rating" varchar(16),
	"image_url" text,
	"url" text,
	"posted_at" timestamp DEFAULT now(),
	CONSTRAINT "posted_deals_deal_id_unique" UNIQUE("deal_id")
);
