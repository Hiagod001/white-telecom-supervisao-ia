CREATE TABLE `auth_login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`successful` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_hash_unique` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
ALTER TABLE `action_logs` ADD `actor_user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `action_logs` ADD `actor_name` text DEFAULT 'Sistema' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `attendant_identity` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `must_change_password` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `password_changed_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;