CREATE TABLE "itad_steam_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"itad_game_id" varchar(128) NOT NULL,
	"steam_app_id" integer NOT NULL,
	"game_title" text NOT NULL,
	"resolved_at" timestamp DEFAULT now() NOT NULL,
	"resolved_by" varchar(32) NOT NULL,
	CONSTRAINT "itad_steam_mappings_itad_game_id_unique" UNIQUE("itad_game_id")
);
--> statement-breakpoint
CREATE INDEX "itad_steam_mappings_steam_app_id_idx" ON "itad_steam_mappings" USING btree ("steam_app_id");--> statement-breakpoint
CREATE INDEX "itad_steam_mappings_game_title_idx" ON "itad_steam_mappings" USING btree ("game_title");