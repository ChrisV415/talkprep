CREATE TABLE IF NOT EXISTS "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tp_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"session_date" text DEFAULT '' NOT NULL,
	"scenario" text DEFAULT '' NOT NULL,
	"who" text DEFAULT '' NOT NULL,
	"situation" text DEFAULT '',
	"response" text DEFAULT '',
	"scores_clarity" integer,
	"scores_composure" integer,
	"scores_outcome" integer,
	"debrief_outcome" text,
	"debrief_happened" text,
	"debrief_different" text,
	"debrief_text" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_counts" (
	"user_id" text NOT NULL,
	"period" text NOT NULL,
	"ai_calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_counts_user_id_period_pk" PRIMARY KEY("user_id","period")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tp_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
