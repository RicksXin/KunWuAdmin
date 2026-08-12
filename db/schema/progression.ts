import { boolean, index, int, json, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { editableConfigColumns } from "./business";
import { configSets } from "./config";
import { createdAtColumn, idColumn, updatedAtColumn, uuidBinary } from "./columns";

export const careers = mysqlTable("career", {
  ...editableConfigColumns(),
  nameKey: varchar("name_key", { length: 160 }).notNull(),
  tier: int("tier", { unsigned: true }).notNull().default(0),
  primaryAttribute: varchar("primary_attribute", { length: 24 }).notNull(),
  baseHp: int("base_hp", { unsigned: true }).notNull(),
  baseStrength: int("base_strength").notNull(),
  baseMagic: int("base_magic").notNull(),
  baseTechnique: int("base_technique").notNull(),
  baseSpeed: int("base_speed").notNull(),
  baseConstitution: int("base_constitution").notNull(),
  baseArmor: int("base_armor").notNull(),
  baseResistance: int("base_resistance").notNull(),
}, (table) => [
  uniqueIndex("uq_career_set_code").on(table.configSetId, table.code),
  index("idx_career_status").on(table.configSetId, table.status, table.sortOrder),
]);

export const careerGrowths = mysqlTable("career_growth", {
  id: idColumn(),
  careerId: uuidBinary("career_id").notNull().references(() => careers.id, { onDelete: "cascade" }),
  strengthPerMille: int("strength_per_mille").notNull(),
  magicPerMille: int("magic_per_mille").notNull(),
  techniquePerMille: int("technique_per_mille").notNull(),
  speedPerMille: int("speed_per_mille").notNull(),
  constitutionPerMille: int("constitution_per_mille").notNull(),
  armorPerMille: int("armor_per_mille").notNull(),
  resistancePerMille: int("resistance_per_mille").notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [uniqueIndex("uq_career_growth_career").on(table.careerId)]);

export const spiritualRoots = mysqlTable("spiritual_root", {
  ...editableConfigColumns(),
  nameKey: varchar("name_key", { length: 160 }).notNull(),
  basePercent: int("base_percent", { unsigned: true }).notNull(),
  growthPercent: int("growth_percent", { unsigned: true }).notNull(),
  rarityOrder: int("rarity_order", { unsigned: true }).notNull(),
}, (table) => [
  uniqueIndex("uq_spiritual_root_set_code").on(table.configSetId, table.code),
  index("idx_spiritual_root_order").on(table.configSetId, table.rarityOrder),
]);

export const realms = mysqlTable("realm", {
  ...editableConfigColumns(),
  nameKey: varchar("name_key", { length: 160 }).notNull(),
  orderIndex: int("order_index", { unsigned: true }).notNull(),
  minLevel: int("min_level", { unsigned: true }).notNull(),
  maxLevel: int("max_level", { unsigned: true }).notNull(),
  breakthroughLevel: int("breakthrough_level", { unsigned: true }),
  breakthroughRecipeCode: varchar("breakthrough_recipe_code", { length: 96 }),
}, (table) => [
  uniqueIndex("uq_realm_set_code").on(table.configSetId, table.code),
  uniqueIndex("uq_realm_set_order").on(table.configSetId, table.orderIndex),
]);

export const levelCosts = mysqlTable("level_cost", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  level: int("level", { unsigned: true }).notNull(),
  soulCrystalCost: int("soul_crystal_cost", { unsigned: true }).notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [uniqueIndex("uq_level_cost_set_level").on(table.configSetId, table.level)]);

export const heroTemplates = mysqlTable("hero_template", {
  ...editableConfigColumns(),
  nameKey: varchar("name_key", { length: 160 }).notNull(),
  careerId: uuidBinary("career_id").notNull().references(() => careers.id),
  spiritualRootId: uuidBinary("spiritual_root_id").notNull().references(() => spiritualRoots.id),
  initialRealmId: uuidBinary("initial_realm_id").notNull().references(() => realms.id),
  initialLevel: int("initial_level", { unsigned: true }).notNull().default(1),
  portraitAssetKey: varchar("portrait_asset_key", { length: 512 }),
  strengthOverride: int("strength_override"),
  magicOverride: int("magic_override"),
  techniqueOverride: int("technique_override"),
  speedOverride: int("speed_override"),
  constitutionOverride: int("constitution_override"),
  armorOverride: int("armor_override"),
  resistanceOverride: int("resistance_override"),
  maxHpOverride: int("max_hp_override", { unsigned: true }),
}, (table) => [
  uniqueIndex("uq_hero_template_set_code").on(table.configSetId, table.code),
  index("idx_hero_template_career").on(table.configSetId, table.careerId, table.status),
]);

export const newPlayerPresets = mysqlTable("new_player_preset", {
  ...editableConfigColumns(),
  name: varchar("name", { length: 128 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  payload: json("payload").notNull(),
}, (table) => [
  uniqueIndex("uq_new_player_preset_set_code").on(table.configSetId, table.code),
  index("idx_new_player_preset_default").on(table.configSetId, table.isDefault, table.status),
]);
