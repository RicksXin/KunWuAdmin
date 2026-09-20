import { boolean, index, int, json, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { editableConfigColumns } from "./business";
import { gameAssets, rewardPacks } from "./base";
import { configSets } from "./config";
import { createdAtColumn, idColumn, updatedAtColumn, uuidBinary } from "./columns";
import { careers, heroTemplates } from "./progression";
import type { SkillMechanics } from "@/server/domain/skills/config";
import type { EnemyDesign,EncounterDesign } from "@/server/domain/encounters/config";

import type {EnemySkillRuntime,EnemyRuntime} from "@/server/domain/encounters/runtime";

export const skills = mysqlTable("skill", {
  ...editableConfigColumns(),
  nameKey: varchar("name_key", { length: 160 }).notNull(),
  damageKind: varchar("damage_kind", { length: 24 }).notNull(),
  targetType: varchar("target_type", { length: 48 }).notNull(),
  ignoreTaunt: boolean("ignore_taunt").notNull().default(false),
  baseIntervalTicks: int("base_interval_ticks", { unsigned: true }).notNull(),
  castTicks: int("cast_ticks", { unsigned: true }).notNull().default(0),
  cooldownTicks: int("cooldown_ticks", { unsigned: true }).notNull().default(0),
  primaryAttribute: varchar("primary_attribute", { length: 24 }),
  primaryPercent: int("primary_percent").notNull().default(0),
  secondaryAttribute: varchar("secondary_attribute", { length: 24 }),
  secondaryPercent: int("secondary_percent").notNull().default(0),
  mechanics: json("mechanics").$type<SkillMechanics>(),
  enemyRuntime: json("enemy_runtime").$type<EnemySkillRuntime>(),
}, (table) => [
  uniqueIndex("uq_skill_set_code").on(table.configSetId, table.code),
  index("idx_skill_kind").on(table.configSetId, table.damageKind, table.status),
]);

export const skillEffects = mysqlTable("skill_effect", {
  id: idColumn(),
  skillId: uuidBinary("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  orderIndex: int("order_index", { unsigned: true }).notNull(),
  trigger: varchar("trigger", { length: 32 }).notNull().default("on_cast"),
  effectType: varchar("effect_type", { length: 32 }).notNull(),
  targetTypeOverride: varchar("target_type_override", { length: 48 }),
  chanceBasisPoints: int("chance_basis_points", { unsigned: true }).notNull().default(10000),
  durationTicks: int("duration_ticks", { unsigned: true }),
  magnitudeInt: int("magnitude_int"),
  parameterJson: json("parameter_json"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  uniqueIndex("uq_skill_effect_order").on(table.skillId, table.orderIndex),
  index("idx_skill_effect_type").on(table.effectType),
]);

export const statusEffects = mysqlTable("status_effect", {
  ...editableConfigColumns(),
  nameKey: varchar("name_key", { length: 160 }),
  category: varchar("category", { length: 32 }).notNull(),
  stackingRule: varchar("stacking_rule", { length: 32 }).notNull().default("refresh"),
  maxStacks: int("max_stacks", { unsigned: true }).notNull().default(1),
  defaultDurationTicks: int("default_duration_ticks", { unsigned: true }),
  dispellable: boolean("dispellable").notNull().default(true),
  parameterSchemaVersion: int("parameter_schema_version", { unsigned: true }).notNull().default(1),
}, (table) => [
  uniqueIndex("uq_status_effect_set_code").on(table.configSetId, table.code),
  index("idx_status_effect_category").on(table.configSetId, table.category, table.status),
]);

export const skillAiRules = mysqlTable("skill_ai_rule", {
  id: idColumn(),
  skillId: uuidBinary("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  priority: int("priority").notNull(),
  conditionType: varchar("condition_type", { length: 48 }).notNull(),
  operator: varchar("operator", { length: 16 }).notNull(),
  thresholdInt: int("threshold_int"),
  targetSelector: varchar("target_selector", { length: 48 }),
  parameterJson: json("parameter_json"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  uniqueIndex("uq_skill_ai_priority").on(table.skillId, table.priority),
]);

export const combatParameters = mysqlTable("combat_parameter", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  code: varchar("code", { length: 96 }).notNull().default("default"),
  tickRate: int("tick_rate", { unsigned: true }).notNull().default(20),
  constitutionHpFactor: int("constitution_hp_factor", { unsigned: true }).notNull(),
  minActionIntervalTicks: int("min_action_interval_ticks", { unsigned: true }).notNull(),
  maxActionIntervalTicks: int("max_action_interval_ticks", { unsigned: true }).notNull(),
  minDamage: int("min_damage", { unsigned: true }).notNull(),
  defenseBase: int("defense_base", { unsigned: true }).notNull(),
  defensePerTenLevels: int("defense_per_ten_levels", { unsigned: true }).notNull().default(0),
  partyInitialActionTimers: json("party_initial_action_timers").notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [uniqueIndex("uq_combat_parameter_set_code").on(table.configSetId, table.code)]);

export const careerSkills = mysqlTable("career_skill", {
  id: idColumn(),
  careerId: uuidBinary("career_id").notNull().references(() => careers.id, { onDelete: "cascade" }),
  skillId: uuidBinary("skill_id").notNull().references(() => skills.id),
  slotIndex: int("slot_index", { unsigned: true }).notNull(),
  unlockLevel: int("unlock_level", { unsigned: true }).notNull().default(1),
  isDefaultAuto: boolean("is_default_auto").notNull().default(true),
  createdAt: createdAtColumn(),
}, (table) => [
  uniqueIndex("uq_career_skill_slot").on(table.careerId, table.slotIndex),
  uniqueIndex("uq_career_skill_skill").on(table.careerId, table.skillId),
]);

export const heroTemplateSkills = mysqlTable("hero_template_skill", {
  id: idColumn(),
  heroTemplateId: uuidBinary("hero_template_id").notNull().references(() => heroTemplates.id, { onDelete: "cascade" }),
  skillId: uuidBinary("skill_id").notNull().references(() => skills.id),
  slotIndex: int("slot_index", { unsigned: true }).notNull(),
  createdAt: createdAtColumn(),
}, (table) => [
  uniqueIndex("uq_hero_template_skill_slot").on(table.heroTemplateId, table.slotIndex),
]);

export const enemies = mysqlTable("enemy", {
  ...editableConfigColumns(),
  design: json("design").$type<EnemyDesign>(),
  runtime: json("runtime").$type<EnemyRuntime>(),
  nameKey: varchar("name_key", { length: 160 }).notNull(),
  raceKey: varchar("race_key", { length: 160 }).notNull(),
  level: int("level", { unsigned: true }).notNull().default(1),
  rank: varchar("rank", { length: 32 }).notNull().default("normal"),
  maxHp: int("max_hp", { unsigned: true }).notNull(),
  strength: int("strength").notNull(),
  magic: int("magic").notNull(),
  technique: int("technique").notNull(),
  speed: int("speed").notNull(),
  constitution: int("constitution").notNull(),
  armor: int("armor").notNull(),
  resistance: int("resistance").notNull(),
  portraitAssetKey: varchar("portrait_asset_key", { length: 512 }),
  modelAssetKey: varchar("model_asset_key", { length: 512 }),
}, (table) => [
  uniqueIndex("uq_enemy_set_code").on(table.configSetId, table.code),
  index("idx_enemy_rank").on(table.configSetId, table.rank, table.status),
]);

export const enemySkills = mysqlTable("enemy_skill", {
  id: idColumn(),
  enemyId: uuidBinary("enemy_id").notNull().references(() => enemies.id, { onDelete: "cascade" }),
  skillId: uuidBinary("skill_id").notNull().references(() => skills.id),
  slotIndex: int("slot_index", { unsigned: true }).notNull(),
  initialCooldownTicks: int("initial_cooldown_ticks", { unsigned: true }).notNull().default(0),
  createdAt: createdAtColumn(),
}, (table) => [uniqueIndex("uq_enemy_skill_slot").on(table.enemyId, table.slotIndex)]);

export const lootPools = mysqlTable("loot_pool", {
  ...editableConfigColumns(),
  drawMode: varchar("draw_mode", { length: 24 }).notNull().default("all"),
  drawCount: int("draw_count", { unsigned: true }).notNull().default(1),
}, (table) => [uniqueIndex("uq_loot_pool_set_code").on(table.configSetId, table.code)]);

export const lootPoolEntries = mysqlTable("loot_pool_entry", {
  id: idColumn(),
  lootPoolId: uuidBinary("loot_pool_id").notNull().references(() => lootPools.id, { onDelete: "cascade" }),
  assetId: uuidBinary("asset_id").references(() => gameAssets.id),
  rewardPackId: uuidBinary("reward_pack_id").references(() => rewardPacks.id),
  quantityMin: int("quantity_min", { unsigned: true }).notNull(),
  quantityMax: int("quantity_max", { unsigned: true }).notNull(),
  weight: int("weight", { unsigned: true }).notNull().default(1),
  conditionJson: json("condition_json"),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAtColumn(),
}, (table) => [index("idx_loot_pool_entry_pool").on(table.lootPoolId, table.sortOrder)]);

export const encounters = mysqlTable("encounter", {
  ...editableConfigColumns(),
  design: json("design").$type<EncounterDesign>(),
  nameKey: varchar("name_key", { length: 160 }),
  encounterType: varchar("encounter_type", { length: 32 }).notNull().default("normal"),
  escapeEnemyHpPercent: int("escape_enemy_hp_percent", { unsigned: true }).notNull().default(0),
  recommendedPower: int("recommended_power", { unsigned: true }),
  battleSceneKey: varchar("battle_scene_key", { length: 512 }),
  firstClearRewardPackId: uuidBinary("first_clear_reward_pack_id").references(() => rewardPacks.id),
  repeatRewardPackId: uuidBinary("repeat_reward_pack_id").references(() => rewardPacks.id),
  lootPoolId: uuidBinary("loot_pool_id").references(() => lootPools.id),
}, (table) => [
  uniqueIndex("uq_encounter_set_code").on(table.configSetId, table.code),
  index("idx_encounter_type").on(table.configSetId, table.encounterType, table.status),
]);

export const encounterMembers = mysqlTable("encounter_member", {
  id: idColumn(),
  encounterId: uuidBinary("encounter_id").notNull().references(() => encounters.id, { onDelete: "cascade" }),
  enemyId: uuidBinary("enemy_id").notNull().references(() => enemies.id),
  memberIndex: int("member_index", { unsigned: true }).notNull(),
  quantity: int("quantity", { unsigned: true }).notNull().default(1),
  positionCode: varchar("position_code", { length: 32 }),
  initialActionTimer: int("initial_action_timer", { unsigned: true }).notNull().default(0),
  parameterOverride: json("parameter_override"),
  createdAt: createdAtColumn(),
}, (table) => [uniqueIndex("uq_encounter_member_index").on(table.encounterId, table.memberIndex)]);
