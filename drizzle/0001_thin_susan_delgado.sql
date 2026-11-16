ALTER TABLE `members` ADD `auth_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `member_auth` ON `members` (`auth_id`);