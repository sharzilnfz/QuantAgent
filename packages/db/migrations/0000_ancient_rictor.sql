-- Extensions must be enabled before any table/column that depends on them.
-- pgcrypto: gen_random_uuid() for uuid PKs. vector (pgvector): later-sprint
-- memory embeddings. Both are idempotent.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE TYPE "public"."agent_name" AS ENUM('technical', 'sentiment', 'fundamental', 'polymarket');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('bullish', 'bearish', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."timeframe" AS ENUM('1Day', '1Hour');--> statement-breakpoint
CREATE TABLE "agent_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"agent" "agent_name" NOT NULL,
	"direction" "direction" NOT NULL,
	"confidence" numeric NOT NULL,
	"rationale" text NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" timeframe NOT NULL,
	"decision_ts" timestamp with time zone NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "alpaca_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_ciphertext" text NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alpaca_credentials_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_items_user_symbol_uq" UNIQUE("user_id","symbol")
);
--> statement-breakpoint
CREATE TABLE "indicator_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" timeframe NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"indicators" jsonb NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "indicator_snapshots_symbol_tf_ts_uq" UNIQUE("symbol","timeframe","ts")
);
--> statement-breakpoint
CREATE TABLE "price_bars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" timeframe NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"open" numeric NOT NULL,
	"high" numeric NOT NULL,
	"low" numeric NOT NULL,
	"close" numeric NOT NULL,
	"volume" numeric NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"source" text DEFAULT 'alpaca' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_bars_symbol_tf_ts_uq" UNIQUE("symbol","timeframe","ts")
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cash" numeric NOT NULL,
	"equity" numeric NOT NULL,
	"positions" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"as_of" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_short_term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"decision_ts" timestamp with time zone NOT NULL,
	"direction" "direction" NOT NULL,
	"confidence" numeric NOT NULL,
	"rationale" text NOT NULL,
	"payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"as_of" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_long_term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"symbol" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"embedding" vector(1536),
	"metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"as_of" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodic_reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"trade_id" text,
	"decision_ts" timestamp with time zone NOT NULL,
	"review_ts" timestamp with time zone NOT NULL,
	"initial_direction" "direction" NOT NULL,
	"initial_confidence" numeric NOT NULL,
	"outcome_return_pct" numeric NOT NULL,
	"holding_bars" numeric NOT NULL,
	"critique" text NOT NULL,
	"lesson_learned" text NOT NULL,
	"contradiction_detected" boolean DEFAULT false NOT NULL,
	"contradiction_details" text,
	"raw" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"as_of" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD CONSTRAINT "agent_outputs_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alpaca_credentials" ADD CONSTRAINT "alpaca_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_outputs_run_id_idx" ON "agent_outputs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "agent_runs_decision_ts_idx" ON "agent_runs" USING btree ("decision_ts");--> statement-breakpoint
CREATE INDEX "indicator_snapshots_symbol_tf_ts_idx" ON "indicator_snapshots" USING btree ("symbol","timeframe","ts");--> statement-breakpoint
CREATE INDEX "indicator_snapshots_as_of_idx" ON "indicator_snapshots" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "price_bars_symbol_tf_ts_idx" ON "price_bars" USING btree ("symbol","timeframe","ts");--> statement-breakpoint
CREATE INDEX "price_bars_as_of_idx" ON "price_bars" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "portfolio_snapshots_user_as_of_idx" ON "portfolio_snapshots" USING btree ("user_id","as_of");--> statement-breakpoint
CREATE INDEX "portfolio_snapshots_as_of_idx" ON "portfolio_snapshots" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "memory_short_term_symbol_idx" ON "memory_short_term" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "memory_short_term_as_of_idx" ON "memory_short_term" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "memory_short_term_decision_ts_idx" ON "memory_short_term" USING btree ("decision_ts");--> statement-breakpoint
CREATE INDEX "memory_long_term_symbol_idx" ON "memory_long_term" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "memory_long_term_category_idx" ON "memory_long_term" USING btree ("category");--> statement-breakpoint
CREATE INDEX "memory_long_term_as_of_idx" ON "memory_long_term" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "episodic_reflections_symbol_idx" ON "episodic_reflections" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "episodic_reflections_as_of_idx" ON "episodic_reflections" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "episodic_reflections_decision_ts_idx" ON "episodic_reflections" USING btree ("decision_ts");
