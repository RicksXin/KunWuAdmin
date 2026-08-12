CREATE TABLE `admin_permission` (
	`id` binary(16) NOT NULL,
	`code` varchar(96) NOT NULL,
	`name` varchar(128) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `admin_permission_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_admin_permission_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `admin_role_permission` (
	`id` binary(16) NOT NULL,
	`role_id` binary(16) NOT NULL,
	`permission_id` binary(16) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `admin_role_permission_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_admin_role_permission` UNIQUE(`role_id`,`permission_id`)
);
--> statement-breakpoint
CREATE TABLE `admin_role` (
	`id` binary(16) NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(96) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `admin_role_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_admin_role_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `admin_session` (
	`id` binary(16) NOT NULL,
	`session_token` varchar(255) NOT NULL,
	`user_id` binary(16) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `admin_session_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_admin_session_token` UNIQUE(`session_token`)
);
--> statement-breakpoint
CREATE TABLE `admin_user_role` (
	`id` binary(16) NOT NULL,
	`user_id` binary(16) NOT NULL,
	`role_id` binary(16) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `admin_user_role_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_admin_user_role` UNIQUE(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `admin_user` (
	`id` binary(16) NOT NULL,
	`email` varchar(254) NOT NULL,
	`display_name` varchar(96) NOT NULL,
	`password_hash` varchar(255),
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`last_login_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `admin_user_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_admin_user_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` binary(16) NOT NULL,
	`actor_id` binary(16),
	`action` varchar(96) NOT NULL,
	`entity_type` varchar(64),
	`entity_id` binary(16),
	`config_set_id` binary(16),
	`request_id` varchar(64),
	`ip_address` varchar(64),
	`details` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `config_change_request` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`source_revision` bigint unsigned NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text,
	`status` varchar(24) NOT NULL DEFAULT 'draft',
	`validation_run_id` binary(16),
	`submitted_by` binary(16),
	`submitted_at` datetime(3),
	`reviewed_by` binary(16),
	`reviewed_at` datetime(3),
	`review_notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `config_change_request_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `config_change_warning_ack` (
	`id` binary(16) NOT NULL,
	`change_request_id` binary(16) NOT NULL,
	`validation_issue_id` binary(16) NOT NULL,
	`acknowledged_by` binary(16),
	`reason` text NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `config_change_warning_ack_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_change_warning_ack` UNIQUE(`change_request_id`,`validation_issue_id`)
);
--> statement-breakpoint
CREATE TABLE `config_channel_head` (
	`channel` varchar(24) NOT NULL,
	`active_release_id` binary(16),
	`updated_by` binary(16),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `config_channel_head_channel` PRIMARY KEY(`channel`)
);
--> statement-breakpoint
CREATE TABLE `config_entity_revision` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`entity_type` varchar(64) NOT NULL,
	`entity_id` binary(16) NOT NULL,
	`entity_code` varchar(96) NOT NULL,
	`revision` int unsigned NOT NULL,
	`operation` varchar(24) NOT NULL,
	`before_data` json,
	`after_data` json,
	`changed_by` binary(16),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`request_id` varchar(64),
	CONSTRAINT `config_entity_revision_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_entity_revision` UNIQUE(`entity_type`,`entity_id`,`revision`)
);
--> statement-breakpoint
CREATE TABLE `config_entity_source` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`entity_type` varchar(64) NOT NULL,
	`entity_id` binary(16) NOT NULL,
	`source_kind` varchar(48) NOT NULL,
	`source_path` text NOT NULL,
	`source_pointer` varchar(512),
	`source_hash` binary(32),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `config_entity_source_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `config_import_issue_source` (
	`id` binary(16) NOT NULL,
	`import_issue_id` binary(16) NOT NULL,
	`source_path` text NOT NULL,
	`source_pointer` varchar(512),
	`source_hash` binary(32),
	CONSTRAINT `config_import_issue_source_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `config_import_issue` (
	`id` binary(16) NOT NULL,
	`import_run_id` binary(16) NOT NULL,
	`severity` varchar(16) NOT NULL,
	`conflict_type` varchar(64) NOT NULL,
	`entity_type` varchar(64),
	`entity_code` varchar(96),
	`candidate_values` json,
	`resolution_status` varchar(24) NOT NULL DEFAULT 'unresolved',
	`resolved_by` binary(16),
	`resolved_at` datetime(3),
	`resolution_notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `config_import_issue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `config_import_run` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`source_kind` varchar(48) NOT NULL,
	`source_root` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'pending',
	`started_at` datetime(3),
	`finished_at` datetime(3),
	`triggered_by` binary(16),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `config_import_run_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `config_publish_lock` (
	`lock_key` varchar(128) NOT NULL,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `config_publish_lock_lock_key` PRIMARY KEY(`lock_key`)
);
--> statement-breakpoint
CREATE TABLE `config_release_module` (
	`id` binary(16) NOT NULL,
	`release_id` binary(16) NOT NULL,
	`module_code` varchar(64) NOT NULL,
	`module_schema_version` int unsigned NOT NULL,
	`sha256` binary(32) NOT NULL,
	`byte_size` bigint unsigned NOT NULL,
	`content_encoding` varchar(24) NOT NULL DEFAULT 'gzip',
	`payload_json` json NOT NULL,
	`artifact` longblob NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `config_release_module_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_release_module` UNIQUE(`release_id`,`module_code`)
);
--> statement-breakpoint
CREATE TABLE `config_release` (
	`id` binary(16) NOT NULL,
	`channel` varchar(24) NOT NULL,
	`sequence` bigint unsigned NOT NULL,
	`version` varchar(64) NOT NULL,
	`schema_version` int unsigned NOT NULL,
	`min_client_version` varchar(32) NOT NULL,
	`source_config_set_id` binary(16) NOT NULL,
	`source_revision` bigint unsigned NOT NULL,
	`change_request_id` binary(16),
	`source_release_id` binary(16),
	`status` varchar(24) NOT NULL DEFAULT 'building',
	`release_notes` text,
	`created_by` binary(16),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`published_at` datetime(3),
	CONSTRAINT `config_release_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_release_channel_sequence` UNIQUE(`channel`,`sequence`),
	CONSTRAINT `uq_release_channel_version` UNIQUE(`channel`,`version`)
);
--> statement-breakpoint
CREATE TABLE `config_set` (
	`id` binary(16) NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`schema_version` int unsigned NOT NULL DEFAULT 1,
	`current_revision` bigint unsigned NOT NULL DEFAULT 0,
	`base_release_id` binary(16),
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`notes` text,
	`created_by` binary(16),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `config_set_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_config_set_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `config_validation_issue` (
	`id` binary(16) NOT NULL,
	`validation_run_id` binary(16) NOT NULL,
	`severity` varchar(16) NOT NULL,
	`module_code` varchar(64),
	`entity_type` varchar(64),
	`entity_code` varchar(96),
	`field_path` varchar(512),
	`rule_code` varchar(96) NOT NULL,
	`message` text NOT NULL,
	`details` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `config_validation_issue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `config_validation_run` (
	`id` binary(16) NOT NULL,
	`config_set_id` binary(16) NOT NULL,
	`source_revision` bigint unsigned NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'pending',
	`error_count` int unsigned NOT NULL DEFAULT 0,
	`warning_count` int unsigned NOT NULL DEFAULT 0,
	`info_count` int unsigned NOT NULL DEFAULT 0,
	`started_at` datetime(3),
	`finished_at` datetime(3),
	`triggered_by` binary(16),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `config_validation_run_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admin_role_permission` ADD CONSTRAINT `admin_role_permission_role_id_admin_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `admin_role`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_role_permission` ADD CONSTRAINT `admin_role_permission_permission_id_admin_permission_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `admin_permission`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_session` ADD CONSTRAINT `admin_session_user_id_admin_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `admin_user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_user_role` ADD CONSTRAINT `admin_user_role_user_id_admin_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `admin_user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_user_role` ADD CONSTRAINT `admin_user_role_role_id_admin_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `admin_role`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_actor_id_admin_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `admin_user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_change_request` ADD CONSTRAINT `config_change_request_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_change_request` ADD CONSTRAINT `config_change_request_submitted_by_admin_user_id_fk` FOREIGN KEY (`submitted_by`) REFERENCES `admin_user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_change_request` ADD CONSTRAINT `config_change_request_reviewed_by_admin_user_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `admin_user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_change_request` ADD CONSTRAINT `fk_change_request_validation` FOREIGN KEY (`validation_run_id`) REFERENCES `config_validation_run`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_change_warning_ack` ADD CONSTRAINT `config_change_warning_ack_acknowledged_by_admin_user_id_fk` FOREIGN KEY (`acknowledged_by`) REFERENCES `admin_user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_change_warning_ack` ADD CONSTRAINT `fk_warning_ack_change` FOREIGN KEY (`change_request_id`) REFERENCES `config_change_request`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_change_warning_ack` ADD CONSTRAINT `fk_warning_ack_issue` FOREIGN KEY (`validation_issue_id`) REFERENCES `config_validation_issue`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_channel_head` ADD CONSTRAINT `config_channel_head_active_release_id_config_release_id_fk` FOREIGN KEY (`active_release_id`) REFERENCES `config_release`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_channel_head` ADD CONSTRAINT `config_channel_head_updated_by_admin_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_entity_revision` ADD CONSTRAINT `config_entity_revision_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_entity_revision` ADD CONSTRAINT `config_entity_revision_changed_by_admin_user_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `admin_user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_entity_source` ADD CONSTRAINT `config_entity_source_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_import_issue_source` ADD CONSTRAINT `fk_import_issue_source_issue` FOREIGN KEY (`import_issue_id`) REFERENCES `config_import_issue`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_import_issue` ADD CONSTRAINT `config_import_issue_import_run_id_config_import_run_id_fk` FOREIGN KEY (`import_run_id`) REFERENCES `config_import_run`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_import_issue` ADD CONSTRAINT `config_import_issue_resolved_by_admin_user_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `admin_user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_import_run` ADD CONSTRAINT `config_import_run_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_import_run` ADD CONSTRAINT `config_import_run_triggered_by_admin_user_id_fk` FOREIGN KEY (`triggered_by`) REFERENCES `admin_user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_release_module` ADD CONSTRAINT `config_release_module_release_id_config_release_id_fk` FOREIGN KEY (`release_id`) REFERENCES `config_release`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_release` ADD CONSTRAINT `config_release_source_config_set_id_config_set_id_fk` FOREIGN KEY (`source_config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_release` ADD CONSTRAINT `config_release_change_request_id_config_change_request_id_fk` FOREIGN KEY (`change_request_id`) REFERENCES `config_change_request`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_release` ADD CONSTRAINT `config_release_created_by_admin_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_set` ADD CONSTRAINT `config_set_created_by_admin_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_validation_issue` ADD CONSTRAINT `fk_validation_issue_run` FOREIGN KEY (`validation_run_id`) REFERENCES `config_validation_run`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_validation_run` ADD CONSTRAINT `config_validation_run_config_set_id_config_set_id_fk` FOREIGN KEY (`config_set_id`) REFERENCES `config_set`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `config_validation_run` ADD CONSTRAINT `config_validation_run_triggered_by_admin_user_id_fk` FOREIGN KEY (`triggered_by`) REFERENCES `admin_user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_admin_role_permission_permission` ON `admin_role_permission` (`permission_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_session_user` ON `admin_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_session_expires` ON `admin_session` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_admin_user_role_role` ON `admin_user_role` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_user_status` ON `admin_user` (`status`);--> statement-breakpoint
CREATE INDEX `idx_audit_actor_time` ON `audit_log` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_set_time` ON `audit_log` (`config_set_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_action_time` ON `audit_log` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_change_request_set_status` ON `config_change_request` (`config_set_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_change_request_revision` ON `config_change_request` (`config_set_id`,`source_revision`);--> statement-breakpoint
CREATE INDEX `idx_entity_revision_set_time` ON `config_entity_revision` (`config_set_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_entity_revision_code` ON `config_entity_revision` (`config_set_id`,`entity_type`,`entity_code`);--> statement-breakpoint
CREATE INDEX `idx_entity_source_entity` ON `config_entity_source` (`config_set_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_import_issue_source_issue` ON `config_import_issue_source` (`import_issue_id`);--> statement-breakpoint
CREATE INDEX `idx_import_issue_run_severity` ON `config_import_issue` (`import_run_id`,`severity`);--> statement-breakpoint
CREATE INDEX `idx_import_issue_entity` ON `config_import_issue` (`entity_type`,`entity_code`);--> statement-breakpoint
CREATE INDEX `idx_import_run_set_time` ON `config_import_run` (`config_set_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_release_module_hash` ON `config_release_module` (`sha256`);--> statement-breakpoint
CREATE INDEX `idx_release_source_revision` ON `config_release` (`source_config_set_id`,`source_revision`);--> statement-breakpoint
CREATE INDEX `idx_release_status_time` ON `config_release` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_config_set_status` ON `config_set` (`status`);--> statement-breakpoint
CREATE INDEX `idx_validation_issue_run_severity` ON `config_validation_issue` (`validation_run_id`,`severity`);--> statement-breakpoint
CREATE INDEX `idx_validation_issue_entity` ON `config_validation_issue` (`entity_type`,`entity_code`);--> statement-breakpoint
CREATE INDEX `idx_validation_set_revision` ON `config_validation_run` (`config_set_id`,`source_revision`);--> statement-breakpoint
CREATE INDEX `idx_validation_status_time` ON `config_validation_run` (`status`,`created_at`);