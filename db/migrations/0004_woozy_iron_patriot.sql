CREATE TABLE `career_route` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name` varchar(80) NOT NULL,
	`initial_career_code` varchar(96) NOT NULL,
	`foundation_career_code` varchar(96) NOT NULL,
	`core_career_code` varchar(96) NOT NULL,
	`foundation_trial` varchar(96) NOT NULL,
	`core_trial` varchar(96) NOT NULL,
	`core_bonus` json NOT NULL,
	CONSTRAINT `career_route_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_career_route_set` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `cultivator_rules` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`payload` json NOT NULL,
	CONSTRAINT `cultivator_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_cultivator_rules_set` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `career_route` ADD CONSTRAINT `career_route_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cultivator_rules` ADD CONSTRAINT `cultivator_rules_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;