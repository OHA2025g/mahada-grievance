CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`kind` text NOT NULL,
	`citizen_id` text,
	`citizen_name` text,
	`mobile` text,
	`title` text NOT NULL,
	`narrative` text,
	`preview` text,
	`narrative_complete` integer DEFAULT 0 NOT NULL,
	`source_portal` text,
	`source_token` text,
	`source_status` text,
	`source_age` integer,
	`source_updated` text,
	`source_nog` text,
	`received_date` text NOT NULL,
	`board` text DEFAULT 'To verify' NOT NULL,
	`office` text,
	`category` text DEFAULT 'Unclassified' NOT NULL,
	`stage` text DEFAULT 'Triage' NOT NULL,
	`outcome` text DEFAULT 'Unknown' NOT NULL,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`restricted` integer DEFAULT 0 NOT NULL,
	`owner_id` text,
	`owner_name` text,
	`respondent_id` text,
	`acceptance` text DEFAULT 'Unassigned' NOT NULL,
	`original_due` text,
	`due_date` text,
	`closed_at` text,
	`details` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`mutation_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_reference` ON `cases` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `case_source` ON `cases` (`source_portal`,`source_token`);--> statement-breakpoint
CREATE INDEX `case_stage` ON `cases` (`stage`);--> statement-breakpoint
CREATE INDEX `case_owner` ON `cases` (`owner_id`);--> statement-breakpoint
CREATE INDEX `case_citizen` ON `cases` (`citizen_id`);--> statement-breakpoint
CREATE INDEX `case_board` ON `cases` (`board`);--> statement-breakpoint
CREATE INDEX `case_received` ON `cases` (`received_date`);--> statement-breakpoint
CREATE TABLE `config_history` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `configs` (
	`key` text PRIMARY KEY NOT NULL,
	`screen` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` text,
	`kind` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_role` text NOT NULL,
	`message` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_case` ON `events` (`case_id`,`id`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`checksum` text NOT NULL,
	`object_key` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`previous_id` text,
	`classification` text DEFAULT 'Normal' NOT NULL,
	`citizen_safe` integer DEFAULT 0 NOT NULL,
	`respondent_safe` integer DEFAULT 0 NOT NULL,
	`description` text,
	`review_state` text DEFAULT 'Unreviewed' NOT NULL,
	`uploaded_by` text NOT NULL,
	`uploaded_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `evidence_case` ON `evidence` (`case_id`);--> statement-breakpoint
CREATE TABLE `idempotency` (
	`key` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`body_hash` text NOT NULL,
	`response` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`import_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`raw` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `import_row_batch` ON `import_rows` (`import_id`,`row_number`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`filename` text NOT NULL,
	`checksum` text NOT NULL,
	`object_key` text NOT NULL,
	`row_count` integer NOT NULL,
	`accepted` integer DEFAULT 0 NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`unchanged` integer DEFAULT 0 NOT NULL,
	`rejected` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`mapping` text DEFAULT '{}' NOT NULL,
	`errors` text DEFAULT '[]' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `import_hash` ON `imports` (`checksum`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`total` integer NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`payload` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`other_id` text NOT NULL,
	`relationship` text NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`other_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_link` ON `links` (`case_id`,`other_id`,`relationship`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`roles` text NOT NULL,
	`boards` text DEFAULT '["All"]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`is_owner` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_email` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`case_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`channel` text DEFAULT 'In-app' NOT NULL,
	`delivery` text DEFAULT 'Available in app' NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notification_user` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text,
	`type` text NOT NULL,
	`screen` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`values` text NOT NULL,
	`author_id` text NOT NULL,
	`actor_role` text NOT NULL,
	`assignee_id` text,
	`due_date` text,
	`parent_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `record_case_type` ON `records` (`case_id`,`type`);--> statement-breakpoint
CREATE INDEX `record_author` ON `records` (`author_id`);--> statement-breakpoint
CREATE INDEX `record_parent` ON `records` (`parent_id`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`import_id` text NOT NULL,
	`portal` text NOT NULL,
	`token` text NOT NULL,
	`row_number` integer NOT NULL,
	`raw` text NOT NULL,
	`snapshot_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_snapshot` ON `sources` (`portal`,`token`,`snapshot_hash`);--> statement-breakpoint
CREATE INDEX `source_case` ON `sources` (`case_id`);