import { bigint, foreignKey, index, int, json, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { adminUsers } from "./auth";
import {
  createdAtColumn,
  hashBinary,
  idColumn,
  longBlob,
  notesColumn,
  statusColumn,
  updatedAtColumn,
  utcDateTime,
  uuidBinary,
} from "./columns";

export const configSets = mysqlTable("config_set", {
  id: idColumn(),
  code: varchar("code", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  schemaVersion: int("schema_version", { unsigned: true }).notNull().default(1),
  currentRevision: bigint("current_revision", { mode: "number", unsigned: true }).notNull().default(0),
  baseReleaseId: uuidBinary("base_release_id"),
  status: statusColumn(),
  notes: notesColumn(),
  createdBy: uuidBinary("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  uniqueIndex("uq_config_set_code").on(table.code),
  index("idx_config_set_status").on(table.status),
]);

export const configPublishLocks = mysqlTable("config_publish_lock", {
  lockKey: varchar("lock_key", { length: 128 }).primaryKey(),
  updatedAt: updatedAtColumn(),
});

export const configEntityRevisions = mysqlTable("config_entity_revision", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: uuidBinary("entity_id").notNull(),
  entityCode: varchar("entity_code", { length: 96 }).notNull(),
  revision: int("revision", { unsigned: true }).notNull(),
  operation: varchar("operation", { length: 24 }).notNull(),
  beforeData: json("before_data"),
  afterData: json("after_data"),
  changedBy: uuidBinary("changed_by").references(() => adminUsers.id, { onDelete: "set null" }),
  changedAt: createdAtColumn(),
  requestId: varchar("request_id", { length: 64 }),
}, (table) => [
  uniqueIndex("uq_entity_revision").on(table.entityType, table.entityId, table.revision),
  index("idx_entity_revision_set_time").on(table.configSetId, table.changedAt),
  index("idx_entity_revision_code").on(table.configSetId, table.entityType, table.entityCode),
]);

export const auditLogs = mysqlTable("audit_log", {
  id: idColumn(),
  actorId: uuidBinary("actor_id").references(() => adminUsers.id, { onDelete: "set null" }),
  action: varchar("action", { length: 96 }).notNull(),
  entityType: varchar("entity_type", { length: 64 }),
  entityId: uuidBinary("entity_id"),
  configSetId: uuidBinary("config_set_id").references(() => configSets.id, { onDelete: "set null" }),
  requestId: varchar("request_id", { length: 64 }),
  ipAddress: varchar("ip_address", { length: 64 }),
  details: json("details"),
  createdAt: createdAtColumn(),
}, (table) => [
  index("idx_audit_actor_time").on(table.actorId, table.createdAt),
  index("idx_audit_set_time").on(table.configSetId, table.createdAt),
  index("idx_audit_action_time").on(table.action, table.createdAt),
]);

export const configImportRuns = mysqlTable("config_import_run", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  sourceKind: varchar("source_kind", { length: 48 }).notNull(),
  sourceRoot: text("source_root").notNull(),
  sourceHash: hashBinary("source_hash"),
  summary: json("summary"),
  status: statusColumn("pending"),
  startedAt: utcDateTime("started_at"),
  finishedAt: utcDateTime("finished_at"),
  triggeredBy: uuidBinary("triggered_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: createdAtColumn(),
}, (table) => [index("idx_import_run_set_time").on(table.configSetId, table.createdAt)]);

export const configImportIssues = mysqlTable("config_import_issue", {
  id: idColumn(),
  importRunId: uuidBinary("import_run_id").notNull().references(() => configImportRuns.id, { onDelete: "cascade" }),
  severity: varchar("severity", { length: 16 }).notNull(),
  conflictType: varchar("conflict_type", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 64 }),
  entityCode: varchar("entity_code", { length: 96 }),
  candidateValues: json("candidate_values"),
  resolutionStatus: varchar("resolution_status", { length: 24 }).notNull().default("unresolved"),
  resolvedBy: uuidBinary("resolved_by").references(() => adminUsers.id, { onDelete: "set null" }),
  resolvedAt: utcDateTime("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  createdAt: createdAtColumn(),
}, (table) => [
  index("idx_import_issue_run_severity").on(table.importRunId, table.severity),
  index("idx_import_issue_entity").on(table.entityType, table.entityCode),
]);

export const configImportIssueSources = mysqlTable("config_import_issue_source", {
  id: idColumn(),
  importIssueId: uuidBinary("import_issue_id").notNull(),
  sourcePath: text("source_path").notNull(),
  sourcePointer: varchar("source_pointer", { length: 512 }),
  sourceHash: hashBinary("source_hash"),
}, (table) => [
  foreignKey({ name: "fk_import_issue_source_issue", columns: [table.importIssueId], foreignColumns: [configImportIssues.id] }).onDelete("cascade"),
  index("idx_import_issue_source_issue").on(table.importIssueId),
]);

export const configEntitySources = mysqlTable("config_entity_source", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: uuidBinary("entity_id").notNull(),
  sourceKind: varchar("source_kind", { length: 48 }).notNull(),
  sourcePath: text("source_path").notNull(),
  sourcePointer: varchar("source_pointer", { length: 512 }),
  sourceHash: hashBinary("source_hash"),
  importedAt: createdAtColumn(),
}, (table) => [
  index("idx_entity_source_entity").on(table.configSetId, table.entityType, table.entityId),
]);

export const configValidationRuns = mysqlTable("config_validation_run", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  sourceRevision: bigint("source_revision", { mode: "number", unsigned: true }).notNull(),
  status: statusColumn("pending"),
  errorCount: int("error_count", { unsigned: true }).notNull().default(0),
  warningCount: int("warning_count", { unsigned: true }).notNull().default(0),
  infoCount: int("info_count", { unsigned: true }).notNull().default(0),
  startedAt: utcDateTime("started_at"),
  finishedAt: utcDateTime("finished_at"),
  triggeredBy: uuidBinary("triggered_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: createdAtColumn(),
}, (table) => [
  index("idx_validation_set_revision").on(table.configSetId, table.sourceRevision),
  index("idx_validation_status_time").on(table.status, table.createdAt),
]);

export const configValidationIssues = mysqlTable("config_validation_issue", {
  id: idColumn(),
  validationRunId: uuidBinary("validation_run_id").notNull(),
  severity: varchar("severity", { length: 16 }).notNull(),
  moduleCode: varchar("module_code", { length: 64 }),
  entityType: varchar("entity_type", { length: 64 }),
  entityCode: varchar("entity_code", { length: 96 }),
  fieldPath: varchar("field_path", { length: 512 }),
  ruleCode: varchar("rule_code", { length: 96 }).notNull(),
  message: text("message").notNull(),
  details: json("details"),
  createdAt: createdAtColumn(),
}, (table) => [
  foreignKey({ name: "fk_validation_issue_run", columns: [table.validationRunId], foreignColumns: [configValidationRuns.id] }).onDelete("cascade"),
  index("idx_validation_issue_run_severity").on(table.validationRunId, table.severity),
  index("idx_validation_issue_entity").on(table.entityType, table.entityCode),
]);

export const configChangeRequests = mysqlTable("config_change_request", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  sourceRevision: bigint("source_revision", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description"),
  status: statusColumn("draft"),
  validationRunId: uuidBinary("validation_run_id"),
  submittedBy: uuidBinary("submitted_by").references(() => adminUsers.id, { onDelete: "set null" }),
  submittedAt: utcDateTime("submitted_at"),
  reviewedBy: uuidBinary("reviewed_by").references(() => adminUsers.id, { onDelete: "set null" }),
  reviewedAt: utcDateTime("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  foreignKey({ name: "fk_change_request_validation", columns: [table.validationRunId], foreignColumns: [configValidationRuns.id] }).onDelete("set null"),
  index("idx_change_request_set_status").on(table.configSetId, table.status),
  index("idx_change_request_revision").on(table.configSetId, table.sourceRevision),
]);

export const configChangeWarningAcks = mysqlTable("config_change_warning_ack", {
  id: idColumn(),
  changeRequestId: uuidBinary("change_request_id").notNull(),
  validationIssueId: uuidBinary("validation_issue_id").notNull(),
  acknowledgedBy: uuidBinary("acknowledged_by").references(() => adminUsers.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  acknowledgedAt: createdAtColumn(),
}, (table) => [
  foreignKey({ name: "fk_warning_ack_change", columns: [table.changeRequestId], foreignColumns: [configChangeRequests.id] }).onDelete("cascade"),
  foreignKey({ name: "fk_warning_ack_issue", columns: [table.validationIssueId], foreignColumns: [configValidationIssues.id] }).onDelete("cascade"),
  uniqueIndex("uq_change_warning_ack").on(table.changeRequestId, table.validationIssueId),
]);

export const configReleases = mysqlTable("config_release", {
  id: idColumn(),
  channel: varchar("channel", { length: 24 }).notNull(),
  sequence: bigint("sequence", { mode: "number", unsigned: true }).notNull(),
  version: varchar("version", { length: 64 }).notNull(),
  schemaVersion: int("schema_version", { unsigned: true }).notNull(),
  minClientVersion: varchar("min_client_version", { length: 32 }).notNull(),
  sourceConfigSetId: uuidBinary("source_config_set_id").notNull().references(() => configSets.id),
  sourceRevision: bigint("source_revision", { mode: "number", unsigned: true }).notNull(),
  changeRequestId: uuidBinary("change_request_id").references(() => configChangeRequests.id, { onDelete: "set null" }),
  sourceReleaseId: uuidBinary("source_release_id"),
  status: statusColumn("building"),
  releaseNotes: text("release_notes"),
  createdBy: uuidBinary("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: createdAtColumn(),
  publishedAt: utcDateTime("published_at"),
}, (table) => [
  uniqueIndex("uq_release_channel_sequence").on(table.channel, table.sequence),
  uniqueIndex("uq_release_channel_version").on(table.channel, table.version),
  index("idx_release_source_revision").on(table.sourceConfigSetId, table.sourceRevision),
  index("idx_release_status_time").on(table.status, table.createdAt),
]);

export const configReleaseModules = mysqlTable("config_release_module", {
  id: idColumn(),
  releaseId: uuidBinary("release_id").notNull().references(() => configReleases.id, { onDelete: "cascade" }),
  moduleCode: varchar("module_code", { length: 64 }).notNull(),
  moduleSchemaVersion: int("module_schema_version", { unsigned: true }).notNull(),
  sha256: hashBinary("sha256").notNull(),
  byteSize: bigint("byte_size", { mode: "number", unsigned: true }).notNull(),
  contentEncoding: varchar("content_encoding", { length: 24 }).notNull().default("gzip"),
  payloadJson: json("payload_json").notNull(),
  artifact: longBlob("artifact").notNull(),
  createdAt: createdAtColumn(),
}, (table) => [
  uniqueIndex("uq_release_module").on(table.releaseId, table.moduleCode),
  index("idx_release_module_hash").on(table.sha256),
]);

export const configChannelHeads = mysqlTable("config_channel_head", {
  channel: varchar("channel", { length: 24 }).primaryKey(),
  activeReleaseId: uuidBinary("active_release_id").references(() => configReleases.id, { onDelete: "restrict" }),
  updatedBy: uuidBinary("updated_by").references(() => adminUsers.id, { onDelete: "set null" }),
  updatedAt: updatedAtColumn(),
});
