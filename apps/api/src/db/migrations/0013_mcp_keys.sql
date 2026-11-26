CREATE TABLE "mcp_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"can_write" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "mcp_keys_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "mcp_todo_requests" (
	"user_id" uuid NOT NULL,
	"request_id" varchar(100) NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"result" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "mcp_todo_requests_user_id_request_id_pk" PRIMARY KEY("user_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "mcp_keys" ADD CONSTRAINT "mcp_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_todo_requests" ADD CONSTRAINT "mcp_todo_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_keys_user_idx" ON "mcp_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mcp_todo_requests_expiry_idx" ON "mcp_todo_requests" USING btree ("expires_at");