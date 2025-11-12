ALTER TABLE "news_settings" ADD COLUMN "channel_id" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "news_settings_guild_source_unique" ON "news_settings" USING btree ("guild_id","source");