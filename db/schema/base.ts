import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { editableConfigColumns } from "./business";
import { configSets } from "./config";
import { createdAtColumn, idColumn, revisionColumn, statusColumn, updatedAtColumn, uuidBinary } from "./columns";

export const i18nTexts = mysqlTable("i18n_text", {
  id: idColumn(),
  configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
  code: varchar("code", { length: 160 }).notNull(),
  locale: varchar("locale", { length: 16 }).notNull(),
  text: text("text").notNull(),
  status: statusColumn(),
  revision: revisionColumn(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  uniqueIndex("uq_i18n_set_code_locale").on(table.configSetId, table.code, table.locale),
  index("idx_i18n_set_status").on(table.configSetId, table.status),
]);

export const gameAssets = mysqlTable("game_asset", {
  ...editableConfigColumns(),
  assetType: varchar("asset_type", { length: 32 }).notNull(),
  nameKey: varchar("name_key", { length: 160 }).notNull(),
  qualityCode: varchar("quality_code", { length: 32 }),
  iconPath: varchar("icon_path", { length: 512 }),
  stackLimit: int("stack_limit", { unsigned: true }).notNull().default(999999),
  weight: int("weight", { unsigned: true }).notNull().default(0),
  storageKind: varchar("storage_kind", { length: 32 }).notNull().default("inventory"),
  isProtected: boolean("is_protected").notNull().default(false),
  isDiscardable: boolean("is_discardable").notNull().default(true),
  isTradeable: boolean("is_tradeable").notNull().default(false),
}, (table) => [
  uniqueIndex("uq_game_asset_set_code").on(table.configSetId, table.code),
  index("idx_game_asset_type").on(table.configSetId, table.assetType, table.status),
]);

export const rewardPacks = mysqlTable("reward_pack", {
  ...editableConfigColumns(),
  nameKey: varchar("name_key", { length: 160 }),
  grantMode: varchar("grant_mode", { length: 24 }).notNull().default("all"),
}, (table) => [
  uniqueIndex("uq_reward_pack_set_code").on(table.configSetId, table.code),
  index("idx_reward_pack_status").on(table.configSetId, table.status, table.sortOrder),
]);

export const rewardPackEntries = mysqlTable("reward_pack_entry", {
  id: idColumn(),
  rewardPackId: uuidBinary("reward_pack_id").notNull().references(() => rewardPacks.id, { onDelete: "cascade" }),
  assetId: uuidBinary("asset_id").notNull().references(() => gameAssets.id),
  quantityMin: int("quantity_min", { unsigned: true }).notNull(),
  quantityMax: int("quantity_max", { unsigned: true }).notNull(),
  weight: int("weight", { unsigned: true }).notNull().default(1),
  pickCountGroup: varchar("pick_count_group", { length: 48 }),
  isFirstTimeOnly: boolean("is_first_time_only").notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  uniqueIndex("uq_reward_entry_asset_order").on(table.rewardPackId, table.assetId, table.sortOrder),
  index("idx_reward_entry_pack").on(table.rewardPackId, table.sortOrder),
]);

export const gameParameters = mysqlTable("game_parameter", {
  ...editableConfigColumns(),
  valueType: varchar("value_type", { length: 24 }).notNull(),
  intValue: int("int_value"),
  decimalValue: decimal("decimal_value", { precision: 20, scale: 6 }),
  boolValue: boolean("bool_value"),
  stringValue: text("string_value"),
  jsonValue: json("json_value"),
}, (table) => [
  uniqueIndex("uq_game_parameter_set_code").on(table.configSetId, table.code),
  index("idx_game_parameter_status").on(table.configSetId, table.status, table.sortOrder),
]);
