CREATE TABLE `audio_transcriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` text NOT NULL,
	`ticket_id` text NOT NULL,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`transcript` text DEFAULT '' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`transcribed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audio_transcriptions_message_id_unique` ON `audio_transcriptions` (`message_id`);