CREATE TABLE "news_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"source" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
