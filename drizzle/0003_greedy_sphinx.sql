ALTER TABLE `invite_codes` ADD `max_uses` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `invite_codes` ADD `use_count` integer DEFAULT 0 NOT NULL;
