CREATE TABLE "posted_news" (
	"id" serial PRIMARY KEY NOT NULL,
	"guid" text NOT NULL,
	"source" text NOT NULL,
	"guild_id" text NOT NULL,
	"message_id" varchar(255),
	"title" text,
	"posted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "posted_news_guid_guild_unique" ON "posted_news" USING btree ("guid","guild_id");--> statement-breakpoint
CREATE INDEX "posted_news_guild_id_idx" ON "posted_news" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "posted_news_source_idx" ON "posted_news" USING btree ("source");--> statement-breakpoint
CREATE INDEX "posted_news_posted_at_idx" ON "posted_news" USING btree ("posted_at");