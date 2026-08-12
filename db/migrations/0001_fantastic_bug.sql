CREATE TABLE `game_asset` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`asset_type` varchar(32) NOT NULL,
	`name_key` varchar(160) NOT NULL,
	`quality_code` varchar(32),
	`icon_path` varchar(512),
	`stack_limit` int unsigned NOT NULL DEFAULT 999999,
	`weight` int unsigned NOT NULL DEFAULT 0,
	`storage_kind` varchar(32) NOT NULL DEFAULT 'inventory',
	`is_protected` boolean NOT NULL DEFAULT false,
	`is_discardable` boolean NOT NULL DEFAULT true,
	`is_tradeable` boolean NOT NULL DEFAULT false,
	CONSTRAINT `game_asset_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_game_asset_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `game_parameter` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`value_type` varchar(24) NOT NULL,
	`int_value` int,
	`decimal_value` decimal(20,6),
	`bool_value` boolean,
	`string_value` text,
	`json_value` json,
	CONSTRAINT `game_parameter_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_game_parameter_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `i18n_text` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(160) NOT NULL,
	`locale` varchar(16) NOT NULL,
	`text` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`revision` int unsigned NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `i18n_text_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_i18n_set_code_locale` UNIQUE(`config_set_id`,`code`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `reward_pack_entry` (
	`id` binary(16) NOT NULL,
	`reward_pack_id` binary(16) NOT NULL,
	`asset_id` binary(16) NOT NULL,
	`quantity_min` int unsigned NOT NULL,
	`quantity_max` int unsigned NOT NULL,
	`weight` int unsigned NOT NULL DEFAULT 1,
	`pick_count_group` varchar(48),
	`is_first_time_only` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `reward_pack_entry_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_reward_entry_asset_order` UNIQUE(`reward_pack_id`,`asset_id`,`sort_order`)
);
--> statement-breakpoint
CREATE TABLE `reward_pack` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name_key` varchar(160),
	`grant_mode` varchar(24) NOT NULL DEFAULT 'all',
	CONSTRAINT `reward_pack_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_reward_pack_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `career_skill` (
	`id` binary(16) NOT NULL,
	`career_id` binary(16) NOT NULL,
	`skill_id` binary(16) NOT NULL,
	`slot_index` int unsigned NOT NULL,
	`unlock_level` int unsigned NOT NULL DEFAULT 1,
	`is_default_auto` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `career_skill_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_career_skill_slot` UNIQUE(`career_id`,`slot_index`),
	CONSTRAINT `uq_career_skill_skill` UNIQUE(`career_id`,`skill_id`)
);
--> statement-breakpoint
CREATE TABLE `combat_parameter` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL DEFAULT 'default',
	`tick_rate` int unsigned NOT NULL DEFAULT 20,
	`constitution_hp_factor` int unsigned NOT NULL,
	`min_action_interval_ticks` int unsigned NOT NULL,
	`max_action_interval_ticks` int unsigned NOT NULL,
	`min_damage` int unsigned NOT NULL,
	`defense_base` int unsigned NOT NULL,
	`defense_per_ten_levels` int unsigned NOT NULL DEFAULT 0,
	`party_initial_action_timers` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `combat_parameter_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_combat_parameter_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `encounter_member` (
	`id` binary(16) NOT NULL,
	`encounter_id` binary(16) NOT NULL,
	`enemy_id` binary(16) NOT NULL,
	`member_index` int unsigned NOT NULL,
	`quantity` int unsigned NOT NULL DEFAULT 1,
	`position_code` varchar(32),
	`initial_action_timer` int unsigned NOT NULL DEFAULT 0,
	`parameter_override` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `encounter_member_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_encounter_member_index` UNIQUE(`encounter_id`,`member_index`)
);
--> statement-breakpoint
CREATE TABLE `encounter` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name_key` varchar(160),
	`encounter_type` varchar(32) NOT NULL DEFAULT 'normal',
	`escape_enemy_hp_percent` int unsigned NOT NULL DEFAULT 0,
	`recommended_power` int unsigned,
	`battle_scene_key` varchar(512),
	`first_clear_reward_pack_id` binary(16),
	`repeat_reward_pack_id` binary(16),
	`loot_pool_id` binary(16),
	CONSTRAINT `encounter_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_encounter_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `enemy` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name_key` varchar(160) NOT NULL,
	`race_key` varchar(160) NOT NULL,
	`level` int unsigned NOT NULL DEFAULT 1,
	`rank` varchar(32) NOT NULL DEFAULT 'normal',
	`max_hp` int unsigned NOT NULL,
	`strength` int NOT NULL,
	`magic` int NOT NULL,
	`technique` int NOT NULL,
	`speed` int NOT NULL,
	`constitution` int NOT NULL,
	`armor` int NOT NULL,
	`resistance` int NOT NULL,
	`portrait_asset_key` varchar(512),
	`model_asset_key` varchar(512),
	CONSTRAINT `enemy_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_enemy_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `enemy_skill` (
	`id` binary(16) NOT NULL,
	`enemy_id` binary(16) NOT NULL,
	`skill_id` binary(16) NOT NULL,
	`slot_index` int unsigned NOT NULL,
	`initial_cooldown_ticks` int unsigned NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `enemy_skill_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_enemy_skill_slot` UNIQUE(`enemy_id`,`slot_index`)
);
--> statement-breakpoint
CREATE TABLE `hero_template_skill` (
	`id` binary(16) NOT NULL,
	`hero_template_id` binary(16) NOT NULL,
	`skill_id` binary(16) NOT NULL,
	`slot_index` int unsigned NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `hero_template_skill_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_hero_template_skill_slot` UNIQUE(`hero_template_id`,`slot_index`)
);
--> statement-breakpoint
CREATE TABLE `loot_pool_entry` (
	`id` binary(16) NOT NULL,
	`loot_pool_id` binary(16) NOT NULL,
	`asset_id` binary(16),
	`reward_pack_id` binary(16),
	`quantity_min` int unsigned NOT NULL,
	`quantity_max` int unsigned NOT NULL,
	`weight` int unsigned NOT NULL DEFAULT 1,
	`condition_json` json,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `loot_pool_entry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loot_pool` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`draw_mode` varchar(24) NOT NULL DEFAULT 'all',
	`draw_count` int unsigned NOT NULL DEFAULT 1,
	CONSTRAINT `loot_pool_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_loot_pool_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `skill_ai_rule` (
	`id` binary(16) NOT NULL,
	`skill_id` binary(16) NOT NULL,
	`priority` int NOT NULL,
	`condition_type` varchar(48) NOT NULL,
	`operator` varchar(16) NOT NULL,
	`threshold_int` int,
	`target_selector` varchar(48),
	`parameter_json` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `skill_ai_rule_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_skill_ai_priority` UNIQUE(`skill_id`,`priority`)
);
--> statement-breakpoint
CREATE TABLE `skill_effect` (
	`id` binary(16) NOT NULL,
	`skill_id` binary(16) NOT NULL,
	`order_index` int unsigned NOT NULL,
	`trigger` varchar(32) NOT NULL DEFAULT 'on_cast',
	`effect_type` varchar(32) NOT NULL,
	`target_type_override` varchar(48),
	`chance_basis_points` int unsigned NOT NULL DEFAULT 10000,
	`duration_ticks` int unsigned,
	`magnitude_int` int,
	`parameter_json` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `skill_effect_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_skill_effect_order` UNIQUE(`skill_id`,`order_index`)
);
--> statement-breakpoint
CREATE TABLE `skill` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name_key` varchar(160) NOT NULL,
	`damage_kind` varchar(24) NOT NULL,
	`target_type` varchar(48) NOT NULL,
	`ignore_taunt` boolean NOT NULL DEFAULT false,
	`base_interval_ticks` int unsigned NOT NULL,
	`cast_ticks` int unsigned NOT NULL DEFAULT 0,
	`cooldown_ticks` int unsigned NOT NULL DEFAULT 0,
	`primary_attribute` varchar(24),
	`primary_percent` int NOT NULL DEFAULT 0,
	`secondary_attribute` varchar(24),
	`secondary_percent` int NOT NULL DEFAULT 0,
	CONSTRAINT `skill_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_skill_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `status_effect` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name_key` varchar(160),
	`category` varchar(32) NOT NULL,
	`stacking_rule` varchar(32) NOT NULL DEFAULT 'refresh',
	`max_stacks` int unsigned NOT NULL DEFAULT 1,
	`default_duration_ticks` int unsigned,
	`dispellable` boolean NOT NULL DEFAULT true,
	`parameter_schema_version` int unsigned NOT NULL DEFAULT 1,
	CONSTRAINT `status_effect_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_status_effect_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `building_level` (
	`id` binary(16) NOT NULL,
	`building_id` binary(16) NOT NULL,
	`level` int unsigned NOT NULL,
	`upgrade_cost_asset_id` binary(16),
	`upgrade_cost_amount` int unsigned NOT NULL DEFAULT 0,
	`unlocks_json` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `building_level_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_building_level` UNIQUE(`building_id`,`level`)
);
--> statement-breakpoint
CREATE TABLE `building` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name_key` varchar(160) NOT NULL,
	`max_level` int unsigned NOT NULL,
	`initial_level` int unsigned NOT NULL DEFAULT 0,
	`unlock_condition` json,
	CONSTRAINT `building_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_building_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `production_job` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`output_asset_id` binary(16) NOT NULL,
	`output_per_worker` int unsigned NOT NULL,
	`upkeep_asset_id` binary(16),
	`upkeep_per_worker` int unsigned NOT NULL DEFAULT 0,
	`shutdown_priority` int unsigned,
	`unlock_condition` json,
	CONSTRAINT `production_job_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_production_job_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `production_rule` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL DEFAULT 'default',
	`base_cycle_seconds` int unsigned NOT NULL,
	`max_offline_cycles` int unsigned NOT NULL,
	`initial_worker_count` int unsigned NOT NULL,
	`workers_per_recruit` int unsigned NOT NULL,
	`recruit_cost_asset_id` binary(16) NOT NULL,
	`recruit_cost_amount` int unsigned NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `production_rule_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_production_rule_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `storage_level` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`asset_id` binary(16) NOT NULL,
	`level` int unsigned NOT NULL,
	`capacity` int unsigned NOT NULL,
	`upgrade_cost_asset_id` binary(16),
	`upgrade_cost_amount` int unsigned NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `storage_level_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_storage_level_asset` UNIQUE(`config_set_id`,`asset_id`,`level`)
);
--> statement-breakpoint
CREATE TABLE `expedition_item_rule` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`asset_id` binary(16) NOT NULL,
	`weight_override` int unsigned,
	`max_carry` int unsigned,
	`consume_timing` varchar(32) NOT NULL DEFAULT 'manual',
	`expedition_effect_code` varchar(64),
	`parameter_json` json,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `expedition_item_rule_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_expedition_item_set_asset` UNIQUE(`config_set_id`,`asset_id`)
);
--> statement-breakpoint
CREATE TABLE `expedition_rule` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL DEFAULT 'default',
	`stamina_max` int unsigned NOT NULL,
	`stamina_recovery_amount` int unsigned NOT NULL,
	`stamina_recovery_interval_seconds` int unsigned NOT NULL,
	`base_burden` int unsigned NOT NULL,
	`strength_burden_factor` int NOT NULL,
	`constitution_burden_factor` int NOT NULL,
	`max_party_presets` int unsigned NOT NULL,
	`party_unlock_costs` json NOT NULL,
	`base_rest_count` int unsigned NOT NULL,
	`field_healing_percent` int unsigned NOT NULL,
	`grain_depletion_step_limit` int unsigned NOT NULL,
	`default_loot_weight` int unsigned NOT NULL,
	`material_loss_basis_points` int unsigned NOT NULL,
	`equipment_loss_basis_points` int unsigned NOT NULL,
	`return_talisman_asset_id` binary(16),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `expedition_rule_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_expedition_rule_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `food_rest_rule` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`asset_id` binary(16) NOT NULL,
	`grain_restored` int unsigned NOT NULL,
	`max_uses_per_rest` int unsigned,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `food_rest_rule_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_food_rest_set_asset` UNIQUE(`config_set_id`,`asset_id`)
);
--> statement-breakpoint
CREATE TABLE `map_definition` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name_key` varchar(160) NOT NULL,
	`display_name` varchar(128),
	`map_number` int unsigned NOT NULL,
	`schema_version` int unsigned NOT NULL DEFAULT 1,
	`scene_path` varchar(512),
	`art_license` varchar(96),
	`width` int unsigned,
	`height` int unsigned,
	`active_width` int unsigned,
	`active_height` int unsigned,
	`entry_x` int,
	`entry_y` int,
	`terrain_document` json,
	`visual_config` json,
	`unlock_condition` json,
	CONSTRAINT `map_definition_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_map_definition_set_code` UNIQUE(`config_set_id`,`code`),
	CONSTRAINT `uq_map_definition_set_number` UNIQUE(`config_set_id`,`map_number`)
);
--> statement-breakpoint
CREATE TABLE `map_expedition_rule` (
	`id` binary(16) NOT NULL,
	`map_id` binary(16) NOT NULL,
	`stamina_cost` int unsigned NOT NULL,
	`grain_per_step` int unsigned NOT NULL,
	`minimum_carried_grain` int unsigned NOT NULL,
	`recommended_party_power` int unsigned,
	`rest_count_override` int unsigned,
	`discovery_radius_override` int unsigned,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `map_expedition_rule_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_map_expedition_rule_map` UNIQUE(`map_id`)
);
--> statement-breakpoint
CREATE TABLE `map_object_placement` (
	`id` binary(16) NOT NULL,
	`map_id` binary(16) NOT NULL,
	`instance_code` varchar(96) NOT NULL,
	`prototype_id` binary(16) NOT NULL,
	`x` int NOT NULL,
	`y` int NOT NULL,
	`first_reward_pack_id` binary(16),
	`repeat_reward_pack_id` binary(16),
	`override_config` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `map_object_placement_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_map_object_placement_instance` UNIQUE(`map_id`,`instance_code`)
);
--> statement-breakpoint
CREATE TABLE `map_object_prototype` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`kind` varchar(48) NOT NULL,
	`title` varchar(256),
	`description` varchar(1024),
	`encounter_id` binary(16),
	`reward_pack_id` binary(16),
	`story_scene_code` varchar(96),
	`refresh_type` varchar(32) NOT NULL DEFAULT 'permanent',
	`interaction_config` json,
	CONSTRAINT `map_object_prototype_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_map_object_prototype_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `career_growth` (
	`id` binary(16) NOT NULL,
	`career_id` binary(16) NOT NULL,
	`strength_per_mille` int NOT NULL,
	`magic_per_mille` int NOT NULL,
	`technique_per_mille` int NOT NULL,
	`speed_per_mille` int NOT NULL,
	`constitution_per_mille` int NOT NULL,
	`armor_per_mille` int NOT NULL,
	`resistance_per_mille` int NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `career_growth_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_career_growth_career` UNIQUE(`career_id`)
);
--> statement-breakpoint
CREATE TABLE `career` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name_key` varchar(160) NOT NULL,
	`tier` int unsigned NOT NULL DEFAULT 0,
	`primary_attribute` varchar(24) NOT NULL,
	`base_hp` int unsigned NOT NULL,
	`base_strength` int NOT NULL,
	`base_magic` int NOT NULL,
	`base_technique` int NOT NULL,
	`base_speed` int NOT NULL,
	`base_constitution` int NOT NULL,
	`base_armor` int NOT NULL,
	`base_resistance` int NOT NULL,
	CONSTRAINT `career_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_career_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `hero_template` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name_key` varchar(160) NOT NULL,
	`career_id` binary(16) NOT NULL,
	`spiritual_root_id` binary(16) NOT NULL,
	`initial_realm_id` binary(16) NOT NULL,
	`initial_level` int unsigned NOT NULL DEFAULT 1,
	`portrait_asset_key` varchar(512),
	`strength_override` int,
	`magic_override` int,
	`technique_override` int,
	`speed_override` int,
	`constitution_override` int,
	`armor_override` int,
	`resistance_override` int,
	`max_hp_override` int unsigned,
	CONSTRAINT `hero_template_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_hero_template_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `level_cost` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`level` int unsigned NOT NULL,
	`soul_crystal_cost` int unsigned NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `level_cost_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_level_cost_set_level` UNIQUE(`config_set_id`,`level`)
);
--> statement-breakpoint
CREATE TABLE `new_player_preset` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name` varchar(128) NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`payload` json NOT NULL,
	CONSTRAINT `new_player_preset_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_new_player_preset_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `realm` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name_key` varchar(160) NOT NULL,
	`order_index` int unsigned NOT NULL,
	`min_level` int unsigned NOT NULL,
	`max_level` int unsigned NOT NULL,
	`breakthrough_level` int unsigned,
	`breakthrough_recipe_code` varchar(96),
	CONSTRAINT `realm_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_realm_set_code` UNIQUE(`config_set_id`,`code`),
	CONSTRAINT `uq_realm_set_order` UNIQUE(`config_set_id`,`order_index`)
);
--> statement-breakpoint
CREATE TABLE `spiritual_root` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`name_key` varchar(160) NOT NULL,
	`base_percent` int unsigned NOT NULL,
	`growth_percent` int unsigned NOT NULL,
	`rarity_order` int unsigned NOT NULL,
	CONSTRAINT `spiritual_root_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_spiritual_root_set_code` UNIQUE(`config_set_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `config_import_run` ADD `source_hash` binary(32);--> statement-breakpoint
ALTER TABLE `config_import_run` ADD `summary` json;--> statement-breakpoint
ALTER TABLE `game_asset` ADD CONSTRAINT `game_asset_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `game_parameter` ADD CONSTRAINT `game_parameter_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `i18n_text` ADD CONSTRAINT `i18n_text_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reward_pack_entry` ADD CONSTRAINT `reward_pack_entry_reward_pack_id_reward_pack_id_fk` FOREIGN KEY (`reward_pack_id`) REFERENCES `reward_pack`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reward_pack_entry` ADD CONSTRAINT `reward_pack_entry_asset_id_game_asset_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reward_pack` ADD CONSTRAINT `reward_pack_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `career_skill` ADD CONSTRAINT `career_skill_career_id_career_id_fk` FOREIGN KEY (`career_id`) REFERENCES `career`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `career_skill` ADD CONSTRAINT `career_skill_skill_id_skill_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `combat_parameter` ADD CONSTRAINT `combat_parameter_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `encounter_member` ADD CONSTRAINT `encounter_member_encounter_id_encounter_id_fk` FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `encounter_member` ADD CONSTRAINT `encounter_member_enemy_id_enemy_id_fk` FOREIGN KEY (`enemy_id`) REFERENCES `enemy`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `encounter` ADD CONSTRAINT `encounter_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `encounter` ADD CONSTRAINT `encounter_first_clear_reward_pack_id_reward_pack_id_fk` FOREIGN KEY (`first_clear_reward_pack_id`) REFERENCES `reward_pack`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `encounter` ADD CONSTRAINT `encounter_repeat_reward_pack_id_reward_pack_id_fk` FOREIGN KEY (`repeat_reward_pack_id`) REFERENCES `reward_pack`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `encounter` ADD CONSTRAINT `encounter_loot_pool_id_loot_pool_id_fk` FOREIGN KEY (`loot_pool_id`) REFERENCES `loot_pool`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enemy` ADD CONSTRAINT `enemy_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enemy_skill` ADD CONSTRAINT `enemy_skill_enemy_id_enemy_id_fk` FOREIGN KEY (`enemy_id`) REFERENCES `enemy`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enemy_skill` ADD CONSTRAINT `enemy_skill_skill_id_skill_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hero_template_skill` ADD CONSTRAINT `hero_template_skill_hero_template_id_hero_template_id_fk` FOREIGN KEY (`hero_template_id`) REFERENCES `hero_template`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hero_template_skill` ADD CONSTRAINT `hero_template_skill_skill_id_skill_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loot_pool_entry` ADD CONSTRAINT `loot_pool_entry_loot_pool_id_loot_pool_id_fk` FOREIGN KEY (`loot_pool_id`) REFERENCES `loot_pool`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loot_pool_entry` ADD CONSTRAINT `loot_pool_entry_asset_id_game_asset_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loot_pool_entry` ADD CONSTRAINT `loot_pool_entry_reward_pack_id_reward_pack_id_fk` FOREIGN KEY (`reward_pack_id`) REFERENCES `reward_pack`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loot_pool` ADD CONSTRAINT `loot_pool_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill_ai_rule` ADD CONSTRAINT `skill_ai_rule_skill_id_skill_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill_effect` ADD CONSTRAINT `skill_effect_skill_id_skill_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill` ADD CONSTRAINT `skill_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `status_effect` ADD CONSTRAINT `status_effect_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `building_level` ADD CONSTRAINT `building_level_building_id_building_id_fk` FOREIGN KEY (`building_id`) REFERENCES `building`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `building_level` ADD CONSTRAINT `building_level_upgrade_cost_asset_id_game_asset_id_fk` FOREIGN KEY (`upgrade_cost_asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `building` ADD CONSTRAINT `building_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_job` ADD CONSTRAINT `production_job_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_job` ADD CONSTRAINT `production_job_output_asset_id_game_asset_id_fk` FOREIGN KEY (`output_asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_job` ADD CONSTRAINT `production_job_upkeep_asset_id_game_asset_id_fk` FOREIGN KEY (`upkeep_asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_rule` ADD CONSTRAINT `production_rule_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_rule` ADD CONSTRAINT `production_rule_recruit_cost_asset_id_game_asset_id_fk` FOREIGN KEY (`recruit_cost_asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storage_level` ADD CONSTRAINT `storage_level_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storage_level` ADD CONSTRAINT `storage_level_asset_id_game_asset_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storage_level` ADD CONSTRAINT `storage_level_upgrade_cost_asset_id_game_asset_id_fk` FOREIGN KEY (`upgrade_cost_asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expedition_item_rule` ADD CONSTRAINT `expedition_item_rule_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expedition_item_rule` ADD CONSTRAINT `expedition_item_rule_asset_id_game_asset_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expedition_rule` ADD CONSTRAINT `expedition_rule_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expedition_rule` ADD CONSTRAINT `expedition_rule_return_talisman_asset_id_game_asset_id_fk` FOREIGN KEY (`return_talisman_asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `food_rest_rule` ADD CONSTRAINT `food_rest_rule_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `food_rest_rule` ADD CONSTRAINT `food_rest_rule_asset_id_game_asset_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `game_asset`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `map_definition` ADD CONSTRAINT `map_definition_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `map_expedition_rule` ADD CONSTRAINT `map_expedition_rule_map_id_map_definition_id_fk` FOREIGN KEY (`map_id`) REFERENCES `map_definition`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `map_object_placement` ADD CONSTRAINT `map_object_placement_map_id_map_definition_id_fk` FOREIGN KEY (`map_id`) REFERENCES `map_definition`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `map_object_placement` ADD CONSTRAINT `map_object_placement_prototype_id_map_object_prototype_id_fk` FOREIGN KEY (`prototype_id`) REFERENCES `map_object_prototype`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `map_object_placement` ADD CONSTRAINT `map_object_placement_first_reward_pack_id_reward_pack_id_fk` FOREIGN KEY (`first_reward_pack_id`) REFERENCES `reward_pack`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `map_object_placement` ADD CONSTRAINT `map_object_placement_repeat_reward_pack_id_reward_pack_id_fk` FOREIGN KEY (`repeat_reward_pack_id`) REFERENCES `reward_pack`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `map_object_prototype` ADD CONSTRAINT `map_object_prototype_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `map_object_prototype` ADD CONSTRAINT `map_object_prototype_encounter_id_encounter_id_fk` FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `map_object_prototype` ADD CONSTRAINT `map_object_prototype_reward_pack_id_reward_pack_id_fk` FOREIGN KEY (`reward_pack_id`) REFERENCES `reward_pack`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `career_growth` ADD CONSTRAINT `career_growth_career_id_career_id_fk` FOREIGN KEY (`career_id`) REFERENCES `career`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `career` ADD CONSTRAINT `career_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hero_template` ADD CONSTRAINT `hero_template_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hero_template` ADD CONSTRAINT `hero_template_career_id_career_id_fk` FOREIGN KEY (`career_id`) REFERENCES `career`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hero_template` ADD CONSTRAINT `hero_template_spiritual_root_id_spiritual_root_id_fk` FOREIGN KEY (`spiritual_root_id`) REFERENCES `spiritual_root`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hero_template` ADD CONSTRAINT `hero_template_initial_realm_id_realm_id_fk` FOREIGN KEY (`initial_realm_id`) REFERENCES `realm`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `level_cost` ADD CONSTRAINT `level_cost_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `new_player_preset` ADD CONSTRAINT `new_player_preset_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `realm` ADD CONSTRAINT `realm_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spiritual_root` ADD CONSTRAINT `spiritual_root_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_game_asset_type` ON `game_asset` (`config_set_id`,`asset_type`,`status`);--> statement-breakpoint
CREATE INDEX `idx_game_parameter_status` ON `game_parameter` (`config_set_id`,`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_i18n_set_status` ON `i18n_text` (`config_set_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_reward_entry_pack` ON `reward_pack_entry` (`reward_pack_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_reward_pack_status` ON `reward_pack` (`config_set_id`,`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_encounter_type` ON `encounter` (`config_set_id`,`encounter_type`,`status`);--> statement-breakpoint
CREATE INDEX `idx_enemy_rank` ON `enemy` (`config_set_id`,`rank`,`status`);--> statement-breakpoint
CREATE INDEX `idx_loot_pool_entry_pool` ON `loot_pool_entry` (`loot_pool_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_skill_effect_type` ON `skill_effect` (`effect_type`);--> statement-breakpoint
CREATE INDEX `idx_skill_kind` ON `skill` (`config_set_id`,`damage_kind`,`status`);--> statement-breakpoint
CREATE INDEX `idx_status_effect_category` ON `status_effect` (`config_set_id`,`category`,`status`);--> statement-breakpoint
CREATE INDEX `idx_building_status` ON `building` (`config_set_id`,`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_production_job_priority` ON `production_job` (`config_set_id`,`shutdown_priority`);--> statement-breakpoint
CREATE INDEX `idx_storage_level_set` ON `storage_level` (`config_set_id`,`level`);--> statement-breakpoint
CREATE INDEX `idx_expedition_item_order` ON `expedition_item_rule` (`config_set_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_map_object_placement_coord` ON `map_object_placement` (`map_id`,`x`,`y`);--> statement-breakpoint
CREATE INDEX `idx_map_object_prototype_kind` ON `map_object_prototype` (`config_set_id`,`kind`,`status`);--> statement-breakpoint
CREATE INDEX `idx_career_status` ON `career` (`config_set_id`,`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_hero_template_career` ON `hero_template` (`config_set_id`,`career_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_new_player_preset_default` ON `new_player_preset` (`config_set_id`,`is_default`,`status`);--> statement-breakpoint
CREATE INDEX `idx_spiritual_root_order` ON `spiritual_root` (`config_set_id`,`rarity_order`);