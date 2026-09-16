CREATE TABLE `resource_admin_audit` (
	`id` varchar(36) NOT NULL,
	`actor_id` varchar(36) NOT NULL,
	`environment` varchar(24) NOT NULL,
	`action` varchar(64) NOT NULL,
	`at_ms` bigint unsigned NOT NULL,
	`reason` text NOT NULL,
	`details` json NOT NULL,
	CONSTRAINT `resource_admin_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resource_claim` (
	`player_id` varchar(36) NOT NULL,
	`claim_id` varchar(128) NOT NULL,
	`payload_hash` varchar(64) NOT NULL,
	`request_id` varchar(64) NOT NULL,
	CONSTRAINT `uq_resource_claim` UNIQUE(`player_id`,`claim_id`)
);
--> statement-breakpoint
CREATE TABLE `resource_ledger` (
	`id` varchar(36) NOT NULL,
	`transaction_id` varchar(36) NOT NULL,
	`asset_code` varchar(32) NOT NULL,
	`before_amount` varchar(20) NOT NULL,
	`after_amount` varchar(20) NOT NULL,
	`delta` varchar(21) NOT NULL,
	CONSTRAINT `resource_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resource_player` (
	`id` varchar(36) NOT NULL,
	`environment` varchar(24) NOT NULL,
	`label` varchar(96) NOT NULL,
	`version` bigint unsigned NOT NULL,
	`state` json NOT NULL,
	`pending` json,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	CONSTRAINT `resource_player_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resource_request` (
	`player_id` varchar(36) NOT NULL,
	`actor_id` varchar(36) NOT NULL,
	`request_id` varchar(64) NOT NULL,
	`payload_hash` varchar(64) NOT NULL,
	`response` json NOT NULL,
	`http_status` int NOT NULL,
	CONSTRAINT `uq_resource_request` UNIQUE(`player_id`,`actor_id`,`request_id`)
);
--> statement-breakpoint
CREATE TABLE `resource_rule_draft` (
	`environment` varchar(24) NOT NULL,
	`revision` int NOT NULL,
	`rules` json NOT NULL,
	`status` varchar(16) NOT NULL,
	`approved_revision` int,
	CONSTRAINT `resource_rule_draft_environment` PRIMARY KEY(`environment`)
);
--> statement-breakpoint
CREATE TABLE `resource_rule_release` (
	`id` varchar(96) NOT NULL,
	`environment` varchar(24) NOT NULL,
	`effective_at` bigint unsigned NOT NULL,
	`rules` json NOT NULL,
	`hash` varchar(64) NOT NULL,
	`actor_id` varchar(36) NOT NULL,
	CONSTRAINT `resource_rule_release_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_resource_activation` UNIQUE(`environment`,`effective_at`)
);
--> statement-breakpoint
CREATE TABLE `resource_session` (
	`token_hash` varchar(64) NOT NULL,
	`actor_id` varchar(36) NOT NULL,
	`actor_kind` varchar(16) NOT NULL,
	`environment` varchar(24) NOT NULL,
	`permissions` json NOT NULL,
	`expires_at` bigint unsigned NOT NULL,
	CONSTRAINT `resource_session_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `resource_transaction` (
	`id` varchar(36) NOT NULL,
	`player_id` varchar(36) NOT NULL,
	`actor_id` varchar(36) NOT NULL,
	`request_id` varchar(64) NOT NULL,
	`at_ms` bigint unsigned NOT NULL,
	`reason` varchar(64) NOT NULL,
	`details` json NOT NULL,
	CONSTRAINT `resource_transaction_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_resource_audit_env_time` ON `resource_admin_audit` (`environment`,`at_ms`);--> statement-breakpoint
CREATE INDEX `idx_resource_ledger_tx` ON `resource_ledger` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_resource_player_env` ON `resource_player` (`environment`);--> statement-breakpoint
CREATE INDEX `idx_resource_session_actor` ON `resource_session` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_resource_tx_player_time` ON `resource_transaction` (`player_id`,`at_ms`,`id`);