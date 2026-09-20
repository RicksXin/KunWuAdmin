CREATE TABLE `crafting_recipe` (
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
	`availability` varchar(16) NOT NULL DEFAULT 'planned',
	`workshop_level` int unsigned NOT NULL,
	`output_code` varchar(96) NOT NULL,
	`output_quantity` int unsigned NOT NULL,
	`costs` json NOT NULL,
	CONSTRAINT `crafting_recipe_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_crafting_recipe_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `item_definition` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`asset_id` binary(16) NOT NULL,
	`name` varchar(80) NOT NULL,
	`category` varchar(32) NOT NULL,
	`usage_tag` varchar(48) NOT NULL,
	CONSTRAINT `item_definition_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_item_definition_code` UNIQUE(`config_set_id`,`code`),
	CONSTRAINT `uq_item_definition_asset` UNIQUE(`asset_id`)
);
--> statement-breakpoint
CREATE TABLE `item_quality` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`scheme_code` varchar(96) NOT NULL,
	`name` varchar(80) NOT NULL,
	`color` varchar(7) NOT NULL,
	CONSTRAINT `item_quality_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_item_quality_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `item_quality_scheme` (
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
	`category` varchar(32) NOT NULL,
	`usage_tag` varchar(48) NOT NULL,
	CONSTRAINT `item_quality_scheme_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_item_scheme_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `crafting_recipe` ADD CONSTRAINT `crafting_recipe_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_definition` ADD CONSTRAINT `item_definition_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_definition` ADD CONSTRAINT `item_definition_asset_id_game_asset_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_quality` ADD CONSTRAINT `item_quality_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_quality_scheme` ADD CONSTRAINT `item_quality_scheme_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;