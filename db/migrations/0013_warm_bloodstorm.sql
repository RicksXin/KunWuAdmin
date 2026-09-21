ALTER TABLE `map_definition` MODIFY COLUMN `width` double;--> statement-breakpoint
ALTER TABLE `map_definition` MODIFY COLUMN `height` double;--> statement-breakpoint
ALTER TABLE `map_definition` MODIFY COLUMN `active_width` double;--> statement-breakpoint
ALTER TABLE `map_definition` MODIFY COLUMN `active_height` double;--> statement-breakpoint
ALTER TABLE `map_definition` MODIFY COLUMN `entry_x` double;--> statement-breakpoint
ALTER TABLE `map_definition` MODIFY COLUMN `entry_y` double;--> statement-breakpoint
ALTER TABLE `map_object_placement` MODIFY COLUMN `x` double NOT NULL;--> statement-breakpoint
ALTER TABLE `map_object_placement` MODIFY COLUMN `y` double NOT NULL;--> statement-breakpoint
ALTER TABLE `map_definition` ADD `runtime_document` json;