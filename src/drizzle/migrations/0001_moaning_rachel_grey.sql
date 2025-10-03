ALTER TABLE "questions" ADD COLUMN "answer" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "feedback" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "feedbackRating" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "answeredAt" timestamp with time zone;