CREATE TABLE `invite_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`created_by_voter_id` text,
	`used_by_voter_id` text,
	`status` text DEFAULT 'unused' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`used_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `movies` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`runtime_minutes` integer,
	`synopsis` text,
	`poster_url` text,
	`source` text NOT NULL,
	`jellyfin_id` text,
	`tmdb_id` text,
	`jellyseerr_request_id` text,
	`status` text DEFAULT 'in_library' NOT NULL,
	`nominated_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`votes_per_voter` integer DEFAULT 5 NOT NULL,
	`max_invite_depth` integer,
	`guest_invite_slots` integer DEFAULT 1 NOT NULL,
	`allow_jellyseerr_requests` integer DEFAULT 1 NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`winner_movie_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_slug_unique` ON `sessions` (`slug`);--> statement-breakpoint
CREATE TABLE `voters` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`display_name` text,
	`invited_by` text,
	`invite_depth` integer DEFAULT 0 NOT NULL,
	`invite_code` text,
	`invite_slots_remaining` integer DEFAULT 1 NOT NULL,
	`joined_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `voters_invite_code_unique` ON `voters` (`invite_code`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`movie_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`voter_id`) REFERENCES `voters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE no action
);
