CREATE TABLE `market_config` (
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
	CONSTRAINT `market_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_market_config_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `item_definition` ADD `details` json;--> statement-breakpoint
ALTER TABLE `market_config` ADD CONSTRAINT `market_config_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;