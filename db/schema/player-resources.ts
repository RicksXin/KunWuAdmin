import { bigint, index, int, json, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

// Resource-domain state only, never a copy of the legacy Godot profile.
export const resourcePlayers = mysqlTable("resource_player", {
  id: varchar("id", {length:36}).primaryKey(), environment: varchar("environment", {length:24}).notNull(),
  label: varchar("label", {length:96}).notNull(), version: bigint("version", {mode:"bigint", unsigned:true}).notNull(),
  state: json("state").notNull(), pending: json("pending"), status:varchar("status",{length:16}).notNull().default("active"),
}, t=>[index("idx_resource_player_env").on(t.environment)]);
export const resourceSessions = mysqlTable("resource_session", {
  tokenHash:varchar("token_hash",{length:64}).primaryKey(), actorId:varchar("actor_id",{length:36}).notNull(),
  actorKind:varchar("actor_kind",{length:16}).notNull(), environment:varchar("environment",{length:24}).notNull(),
  permissions:json("permissions").notNull(), expiresAt:bigint("expires_at",{mode:"number",unsigned:true}).notNull(),
}, t=>[index("idx_resource_session_actor").on(t.actorId)]);
export const resourceRuleDrafts = mysqlTable("resource_rule_draft", {
  environment:varchar("environment",{length:24}).primaryKey(), revision:int("revision").notNull(),
  rules:json("rules").notNull(), status:varchar("status",{length:16}).notNull(), approvedRevision:int("approved_revision"),
});
export const resourceRuleReleases = mysqlTable("resource_rule_release", {
  id:varchar("id",{length:96}).primaryKey(), environment:varchar("environment",{length:24}).notNull(),
  effectiveAt:bigint("effective_at",{mode:"number",unsigned:true}).notNull(), rules:json("rules").notNull(),
  hash:varchar("hash",{length:64}).notNull(), actorId:varchar("actor_id",{length:36}).notNull(),
},t=>[uniqueIndex("uq_resource_activation").on(t.environment,t.effectiveAt)]);
export const resourceRequests = mysqlTable("resource_request", {
  playerId:varchar("player_id",{length:36}).notNull(), actorId:varchar("actor_id",{length:36}).notNull(),
  requestId:varchar("request_id",{length:64}).notNull(), payloadHash:varchar("payload_hash",{length:64}).notNull(),
  response:json("response").notNull(), httpStatus:int("http_status").notNull(),
},t=>[uniqueIndex("uq_resource_request").on(t.playerId,t.actorId,t.requestId)]);
export const resourceTransactions = mysqlTable("resource_transaction", {
  id:varchar("id",{length:36}).primaryKey(), playerId:varchar("player_id",{length:36}).notNull(),
  actorId:varchar("actor_id",{length:36}).notNull(), requestId:varchar("request_id",{length:64}).notNull(),
  atMs:bigint("at_ms",{mode:"number",unsigned:true}).notNull(), reason:varchar("reason",{length:64}).notNull(),
  details:json("details").notNull(),
},t=>[index("idx_resource_tx_player_time").on(t.playerId,t.atMs,t.id)]);
export const resourceLedger = mysqlTable("resource_ledger", {
  id:varchar("id",{length:36}).primaryKey(), transactionId:varchar("transaction_id",{length:36}).notNull(),
  assetCode:varchar("asset_code",{length:32}).notNull(), beforeAmount:varchar("before_amount",{length:20}).notNull(),
  afterAmount:varchar("after_amount",{length:20}).notNull(), delta:varchar("delta",{length:21}).notNull(),
},t=>[index("idx_resource_ledger_tx").on(t.transactionId)]);
export const resourceClaims = mysqlTable("resource_claim", {
  playerId:varchar("player_id",{length:36}).notNull(), claimId:varchar("claim_id",{length:128}).notNull(),
  payloadHash:varchar("payload_hash",{length:64}).notNull(), requestId:varchar("request_id",{length:64}).notNull(),
},t=>[uniqueIndex("uq_resource_claim").on(t.playerId,t.claimId)]);
export const resourceAudit = mysqlTable("resource_admin_audit", {
  id:varchar("id",{length:36}).primaryKey(), actorId:varchar("actor_id",{length:36}).notNull(), environment:varchar("environment",{length:24}).notNull(),
  action:varchar("action",{length:64}).notNull(), atMs:bigint("at_ms",{mode:"number",unsigned:true}).notNull(),
  reason:text("reason").notNull(), details:json("details").notNull(),
},t=>[index("idx_resource_audit_env_time").on(t.environment,t.atMs)]);
