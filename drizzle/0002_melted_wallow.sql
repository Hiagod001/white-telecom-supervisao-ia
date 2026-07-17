CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`owner` text NOT NULL,
	`priority` text DEFAULT 'Media' NOT NULL,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`due_date` text,
	`source_type` text DEFAULT 'Manual' NOT NULL,
	`source_id` text,
	`source_title` text DEFAULT '' NOT NULL,
	`conversation_id` text,
	`resolution_note` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT 'Sistema' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
