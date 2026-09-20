ALTER TABLE `hero_template` ADD `appearance_code` varchar(96);--> statement-breakpoint
ALTER TABLE `hero_template` ADD `name_pool` json;--> statement-breakpoint
ALTER TABLE `hero_template` ADD `growth_focus` varchar(120);--> statement-breakpoint
ALTER TABLE `hero_template` ADD `growth_modifiers` json;