import { double, index, int, json, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { rewardPacks } from "./base";
import { editableConfigColumns } from "./business";
import { encounters } from "./combat";
import { createdAtColumn, idColumn, updatedAtColumn, uuidBinary } from "./columns";

export const mapDefinitions = mysqlTable("map_definition", {
  ...editableConfigColumns(),
  nameKey: varchar("name_key", { length: 160 }).notNull(),
  displayName: varchar("display_name", { length: 128 }),
  mapNumber: int("map_number", { unsigned: true }).notNull(),
  schemaVersion: int("schema_version", { unsigned: true }).notNull().default(1),
  scenePath: varchar("scene_path", { length: 512 }),
  artLicense: varchar("art_license", { length: 96 }),
  width: double("width"),
  height: double("height"),
  activeWidth: double("active_width"),
  activeHeight: double("active_height"),
  entryX: double("entry_x"),
  entryY: double("entry_y"),
  terrainDocument: json("terrain_document"),
  runtimeDocument: json("runtime_document"),
  visualConfig: json("visual_config"),
  unlockCondition: json("unlock_condition"),
}, (table) => [
  uniqueIndex("uq_map_definition_set_code").on(table.configSetId, table.code),
  uniqueIndex("uq_map_definition_set_number").on(table.configSetId, table.mapNumber),
]);

export const mapExpeditionRules = mysqlTable("map_expedition_rule", {
  id: idColumn(),
  mapId: uuidBinary("map_id").notNull().references(() => mapDefinitions.id, { onDelete: "cascade" }),
  staminaCost: int("stamina_cost", { unsigned: true }).notNull(),
  grainPerStep: int("grain_per_step", { unsigned: true }).notNull(),
  minimumCarriedGrain: int("minimum_carried_grain", { unsigned: true }).notNull(),
  recommendedPartyPower: int("recommended_party_power", { unsigned: true }),
  restCountOverride: int("rest_count_override", { unsigned: true }),
  discoveryRadiusOverride: int("discovery_radius_override", { unsigned: true }),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [uniqueIndex("uq_map_expedition_rule_map").on(table.mapId)]);

export const mapObjectPrototypes = mysqlTable("map_object_prototype", {
  ...editableConfigColumns(),
  kind: varchar("kind", { length: 48 }).notNull(),
  title: varchar("title", { length: 256 }),
  description: varchar("description", { length: 1024 }),
  encounterId: uuidBinary("encounter_id").references(() => encounters.id),
  rewardPackId: uuidBinary("reward_pack_id").references(() => rewardPacks.id),
  storySceneCode: varchar("story_scene_code", { length: 96 }),
  refreshType: varchar("refresh_type", { length: 32 }).notNull().default("permanent"),
  interactionConfig: json("interaction_config"),
}, (table) => [
  uniqueIndex("uq_map_object_prototype_set_code").on(table.configSetId, table.code),
  index("idx_map_object_prototype_kind").on(table.configSetId, table.kind, table.status),
]);

export const mapObjectPlacements = mysqlTable("map_object_placement", {
  id: idColumn(),
  mapId: uuidBinary("map_id").notNull().references(() => mapDefinitions.id, { onDelete: "cascade" }),
  instanceCode: varchar("instance_code", { length: 96 }).notNull(),
  prototypeId: uuidBinary("prototype_id").notNull().references(() => mapObjectPrototypes.id),
  x: double("x").notNull(),
  y: double("y").notNull(),
  firstRewardPackId: uuidBinary("first_reward_pack_id").references(() => rewardPacks.id),
  repeatRewardPackId: uuidBinary("repeat_reward_pack_id").references(() => rewardPacks.id),
  overrideConfig: json("override_config"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  uniqueIndex("uq_map_object_placement_instance").on(table.mapId, table.instanceCode),
  index("idx_map_object_placement_coord").on(table.mapId, table.x, table.y),
]);
