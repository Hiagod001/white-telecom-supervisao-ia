CREATE TABLE `blip_attendants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`identity` text NOT NULL,
	`full_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`teams_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'Offline' NOT NULL,
	`agent_slots` integer DEFAULT 0 NOT NULL,
	`tickets_in_service` integer DEFAULT 0 NOT NULL,
	`last_service_at` text,
	`synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blip_attendants_identity_unique` ON `blip_attendants` (`identity`);--> statement-breakpoint
CREATE TABLE `blip_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`ticket_id` text NOT NULL,
	`customer_identity` text DEFAULT '' NOT NULL,
	`sender_identity` text DEFAULT '' NOT NULL,
	`sender_name` text DEFAULT '' NOT NULL,
	`role` text NOT NULL,
	`content_type` text DEFAULT 'text/plain' NOT NULL,
	`content_text` text DEFAULT '' NOT NULL,
	`media_uri` text,
	`storage_date` text NOT NULL,
	`status` text DEFAULT 'Recebida' NOT NULL,
	`raw_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blip_messages_external_id_unique` ON `blip_messages` (`external_id`);--> statement-breakpoint
CREATE TABLE `blip_sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`attendants` integer DEFAULT 0 NOT NULL,
	`tickets` integer DEFAULT 0 NOT NULL,
	`messages` integer DEFAULT 0 NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE TABLE `blip_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`sequential_id` text DEFAULT '' NOT NULL,
	`customer_identity` text NOT NULL,
	`customer_name` text DEFAULT 'Cliente Blip' NOT NULL,
	`attendant_identity` text DEFAULT '' NOT NULL,
	`attendant_name` text DEFAULT 'Nao atribuido' NOT NULL,
	`team` text DEFAULT 'Atendimento' NOT NULL,
	`status` text DEFAULT 'Waiting' NOT NULL,
	`channel` text DEFAULT 'WhatsApp' NOT NULL,
	`opened_at` text NOT NULL,
	`closed_at` text,
	`last_message_at` text,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`raw_json` text DEFAULT '{}' NOT NULL,
	`synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blip_tickets_external_id_unique` ON `blip_tickets` (`external_id`);--> statement-breakpoint
CREATE TABLE `conversation_analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_id` text NOT NULL,
	`process_ids_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`result_json` text DEFAULT '{}' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`analyzed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_analyses_ticket_id_unique` ON `conversation_analyses` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `process_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`process_id` integer NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_key` text,
	`extracted_text` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Disponivel' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`process_id`) REFERENCES `process_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `process_definitions` ADD `instructions` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `process_definitions` ADD `channels_json` text DEFAULT '[]' NOT NULL;