CREATE TABLE "reaction_role_buttons" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"role_id" varchar(255) NOT NULL,
	"emoji" varchar(100) NOT NULL,
	"label" varchar(100) NOT NULL,
	"button_id" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reaction_role_buttons_button_id_unique" UNIQUE("button_id")
);
--> statement-breakpoint
CREATE TABLE "reaction_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"guild_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reaction_roles_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"username" text NOT NULL,
	"game_id" varchar(128) NOT NULL,
	"title" text NOT NULL,
	"historical_low" integer,
	"current_price" integer,
	"target_price" integer,
	"notified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"notifications_enabled" boolean DEFAULT true,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "posted_deals" ADD COLUMN "posted_price" real;--> statement-breakpoint
ALTER TABLE "posted_deals" ADD COLUMN "lowest_ever" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "posted_deals" ADD COLUMN "historical_low" real;--> statement-breakpoint
ALTER TABLE "posted_deals" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_game_id_idx" ON "subscriptions" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "posted_deals_expires_at_idx" ON "posted_deals" USING btree ("expires_at");