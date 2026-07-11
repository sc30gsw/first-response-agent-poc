CREATE TABLE `agent_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agent_run_leases` (
	`subject_key` text PRIMARY KEY NOT NULL,
	`lease_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `eve_session_bindings` (
	`session_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`revoked_at` integer,
	`purge_requested_at` integer,
	`purged_at` integer
);
--> statement-breakpoint
CREATE INDEX `eve_session_bindings_user_idx` ON `eve_session_bindings` (`user_id`);--> statement-breakpoint
CREATE INDEX `eve_session_bindings_thread_idx` ON `eve_session_bindings` (`thread_id`);--> statement-breakpoint
CREATE TABLE `rateLimit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rateLimit_key_unique` ON `rateLimit` (`key`);--> statement-breakpoint
DROP TABLE IF EXISTS `phone_links`;--> statement-breakpoint
DROP TABLE IF EXISTS `slack_link_codes`;--> statement-breakpoint
DROP TABLE IF EXISTS `slack_links`;--> statement-breakpoint
DROP TABLE IF EXISTS `user_memory`;--> statement-breakpoint
DROP TABLE IF EXISTS `user_profiles`;--> statement-breakpoint
ALTER TABLE `threads` ADD `summary` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `threads` ADD `state_version` integer DEFAULT 0 NOT NULL;
