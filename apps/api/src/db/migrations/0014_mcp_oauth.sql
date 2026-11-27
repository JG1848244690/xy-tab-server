CREATE TABLE "mcp_oauth_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"grant_id" text NOT NULL,
	"interaction_id" text NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "mcp_oauth_grants_grant_id_unique" UNIQUE("grant_id"),
	CONSTRAINT "mcp_oauth_grants_interaction_id_unique" UNIQUE("interaction_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_records" (
	"model" text NOT NULL,
	"id_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"grant_id" text,
	"uid" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "mcp_oauth_records_model_id_hash_pk" PRIMARY KEY("model","id_hash")
);
--> statement-breakpoint
ALTER TABLE "mcp_oauth_grants" ADD CONSTRAINT "mcp_oauth_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_oauth_grants_user_idx" ON "mcp_oauth_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mcp_oauth_records_grant_idx" ON "mcp_oauth_records" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "mcp_oauth_records_uid_idx" ON "mcp_oauth_records" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "mcp_oauth_records_expiry_idx" ON "mcp_oauth_records" USING btree ("expires_at");