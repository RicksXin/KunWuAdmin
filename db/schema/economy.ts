import { index, int, json, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { gameAssets } from "./base";
import { editableConfigColumns } from "./business";
import { configSets } from "./config";
import { createdAtColumn, idColumn, updatedAtColumn, uuidBinary } from "./columns";

export const buildings = mysqlTable("building", {
  ...editableConfigColumns(),
  nameKey: varchar("name_key", { length: 160 }).notNull(),
  maxLevel: int("max_level", { unsigned: true }).notNull(),
  initialLevel: int("initial_level", { unsigned: true }).notNull().default(0),
  unlockCondition: json("unlock_condition"),
}, (table) => [
  uniqueIndex("uq_building_set_code").on(table.configSetId, table.code),
  index("idx_building_status").on(table.configSetId, table.status, table.sortOrder),
]);

export const buildingLevels = mysqlTable("building_level", {
  id: idColumn(),
  buildingId: uuidBinary("building_id").notNull().references(() => buildings.id, { onDelete: "cascade" }),
  level: int("level", { unsigned: true }).notNull(),
  upgradeCostAssetId: uuidBinary("upgrade_cost_asset_id").references(() => gameAssets.id),
  upgradeCostAmount: int("upgrade_cost_amount", { unsigned: true }).notNull().default(0),
  unlocksJson: json("unlocks_json"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [uniqueIndex("uq_building_level").on(table.buildingId, table.level)]);

export const productionRules = mysqlTable("production_rule", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  code: varchar("code", { length: 96 }).notNull().default("default"),
  baseCycleSeconds: int("base_cycle_seconds", { unsigned: true }).notNull(),
  maxOfflineCycles: int("max_offline_cycles", { unsigned: true }).notNull(),
  initialWorkerCount: int("initial_worker_count", { unsigned: true }).notNull(),
  workersPerRecruit: int("workers_per_recruit", { unsigned: true }).notNull(),
  recruitCostAssetId: uuidBinary("recruit_cost_asset_id").notNull().references(() => gameAssets.id),
  recruitCostAmount: int("recruit_cost_amount", { unsigned: true }).notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [uniqueIndex("uq_production_rule_set_code").on(table.configSetId, table.code)]);

export const productionJobs = mysqlTable("production_job", {
  ...editableConfigColumns(),
  outputAssetId: uuidBinary("output_asset_id").notNull().references(() => gameAssets.id),
  outputPerWorker: int("output_per_worker", { unsigned: true }).notNull(),
  upkeepAssetId: uuidBinary("upkeep_asset_id").references(() => gameAssets.id),
  upkeepPerWorker: int("upkeep_per_worker", { unsigned: true }).notNull().default(0),
  shutdownPriority: int("shutdown_priority", { unsigned: true }),
  unlockCondition: json("unlock_condition"),
}, (table) => [
  uniqueIndex("uq_production_job_set_code").on(table.configSetId, table.code),
  index("idx_production_job_priority").on(table.configSetId, table.shutdownPriority),
]);

export const storageLevels = mysqlTable("storage_level", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  assetId: uuidBinary("asset_id").notNull().references(() => gameAssets.id),
  level: int("level", { unsigned: true }).notNull(),
  capacity: int("capacity", { unsigned: true }).notNull(),
  upgradeCostAssetId: uuidBinary("upgrade_cost_asset_id").references(() => gameAssets.id),
  upgradeCostAmount: int("upgrade_cost_amount", { unsigned: true }).notNull().default(0),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  uniqueIndex("uq_storage_level_asset").on(table.configSetId, table.assetId, table.level),
  index("idx_storage_level_set").on(table.configSetId, table.level),
]);
