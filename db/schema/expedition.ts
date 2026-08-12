import { index, int, json, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { gameAssets } from "./base";
import { configSets } from "./config";
import { createdAtColumn, idColumn, updatedAtColumn, uuidBinary } from "./columns";

export const expeditionRules = mysqlTable("expedition_rule", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  code: varchar("code", { length: 96 }).notNull().default("default"),
  staminaMax: int("stamina_max", { unsigned: true }).notNull(),
  staminaRecoveryAmount: int("stamina_recovery_amount", { unsigned: true }).notNull(),
  staminaRecoveryIntervalSeconds: int("stamina_recovery_interval_seconds", { unsigned: true }).notNull(),
  baseBurden: int("base_burden", { unsigned: true }).notNull(),
  strengthBurdenFactor: int("strength_burden_factor").notNull(),
  constitutionBurdenFactor: int("constitution_burden_factor").notNull(),
  maxPartyPresets: int("max_party_presets", { unsigned: true }).notNull(),
  partyUnlockCosts: json("party_unlock_costs").notNull(),
  baseRestCount: int("base_rest_count", { unsigned: true }).notNull(),
  fieldHealingPercent: int("field_healing_percent", { unsigned: true }).notNull(),
  grainDepletionStepLimit: int("grain_depletion_step_limit", { unsigned: true }).notNull(),
  defaultLootWeight: int("default_loot_weight", { unsigned: true }).notNull(),
  materialLossBasisPoints: int("material_loss_basis_points", { unsigned: true }).notNull(),
  equipmentLossBasisPoints: int("equipment_loss_basis_points", { unsigned: true }).notNull(),
  returnTalismanAssetId: uuidBinary("return_talisman_asset_id").references(() => gameAssets.id),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [uniqueIndex("uq_expedition_rule_set_code").on(table.configSetId, table.code)]);

export const expeditionItemRules = mysqlTable("expedition_item_rule", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  assetId: uuidBinary("asset_id").notNull().references(() => gameAssets.id),
  weightOverride: int("weight_override", { unsigned: true }),
  maxCarry: int("max_carry", { unsigned: true }),
  consumeTiming: varchar("consume_timing", { length: 32 }).notNull().default("manual"),
  expeditionEffectCode: varchar("expedition_effect_code", { length: 64 }),
  parameterJson: json("parameter_json"),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  uniqueIndex("uq_expedition_item_set_asset").on(table.configSetId, table.assetId),
  index("idx_expedition_item_order").on(table.configSetId, table.sortOrder),
]);

export const foodRestRules = mysqlTable("food_rest_rule", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  assetId: uuidBinary("asset_id").notNull().references(() => gameAssets.id),
  grainRestored: int("grain_restored", { unsigned: true }).notNull(),
  maxUsesPerRest: int("max_uses_per_rest", { unsigned: true }),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [uniqueIndex("uq_food_rest_set_asset").on(table.configSetId, table.assetId)]);
