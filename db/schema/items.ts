import { boolean, int, json, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { editableConfigColumns } from "./business";
import { gameAssets } from "./base";
import { uuidBinary } from "./columns";
import type { CraftCost } from "../../server/domain/items/config";

export const itemQualitySchemes = mysqlTable("item_quality_scheme", {
  ...editableConfigColumns(),
  name: varchar("name", { length: 80 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  usageTag: varchar("usage_tag", { length: 48 }).notNull(),
}, t => [uniqueIndex("uq_item_scheme_code").on(t.configSetId, t.code)]);
export const itemQualities = mysqlTable("item_quality", {
  ...editableConfigColumns(),
  schemeCode: varchar("scheme_code", { length: 96 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
}, t => [uniqueIndex("uq_item_quality_code").on(t.configSetId, t.code)]);
export const itemDefinitions = mysqlTable("item_definition", {
  ...editableConfigColumns(),
  details: json("details").$type<Record<string,unknown>>(),
  isMarketSellable: boolean("is_market_sellable").notNull().default(false),
  assetId: uuidBinary("asset_id").notNull().references(() => gameAssets.id),
  name: varchar("name", { length: 80 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  usageTag: varchar("usage_tag", { length: 48 }).notNull(),
}, t => [uniqueIndex("uq_item_definition_code").on(t.configSetId, t.code), uniqueIndex("uq_item_definition_asset").on(t.assetId)]);
export const craftingRecipes = mysqlTable("crafting_recipe", {
  ...editableConfigColumns(),
  name: varchar("name", { length: 80 }).notNull(),
  availability: varchar("availability", { length: 16 }).notNull().default("planned"),
  workshopLevel: int("workshop_level", { unsigned: true }).notNull(),
  outputCode: varchar("output_code", { length: 96 }).notNull(),
  outputQuantity: int("output_quantity", { unsigned: true }).notNull(),
  outcomes: json("outcomes").$type<{code:string;quantity:number;weight:number}[]>(),
  costs: json("costs").$type<CraftCost[]>().notNull(),
}, t => [uniqueIndex("uq_crafting_recipe_code").on(t.configSetId, t.code)]);

export const marketConfigs=mysqlTable("market_config",{...editableConfigColumns(),payload:json("payload").$type<Record<string,unknown>>().notNull()},t=>[uniqueIndex("uq_market_config_code").on(t.configSetId,t.code)]);
