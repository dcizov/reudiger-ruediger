CREATE TABLE "user_role_cooldowns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"guild_id" varchar(255) NOT NULL,
	"last_changed" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reaction_role_buttons" ADD COLUMN "category" varchar(100);--> statement-breakpoint
ALTER TABLE "reaction_role_buttons" ADD COLUMN "requires_existing_roles" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "reaction_role_buttons" ADD COLUMN "required" boolean DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_cooldowns_user_guild_unique" ON "user_role_cooldowns" USING btree ("user_id","guild_id");