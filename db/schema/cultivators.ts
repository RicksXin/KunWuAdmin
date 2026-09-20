import { json, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { editableConfigColumns } from "./business";
import type { Rules } from "../../server/domain/cultivators/config";
export const cultivatorRules=mysqlTable("cultivator_rules",{
 ...editableConfigColumns(),payload:json("payload").$type<Omit<Rules,"code"|"revision"|"levelCosts">>().notNull(),
},t=>[uniqueIndex("uq_cultivator_rules_set").on(t.configSetId,t.code)]);
export const careerRoutes=mysqlTable("career_route",{
 ...editableConfigColumns(),name:varchar("name",{length:80}).notNull(),
 initialCareerCode:varchar("initial_career_code",{length:96}).notNull(),
 foundationCareerCode:varchar("foundation_career_code",{length:96}).notNull(),
 coreCareerCode:varchar("core_career_code",{length:96}).notNull(),
 foundationTrial:varchar("foundation_trial",{length:96}).notNull(),coreTrial:varchar("core_trial",{length:96}).notNull(),
 coreBonus:json("core_bonus").$type<Record<string,number>>().notNull(),
},t=>[uniqueIndex("uq_career_route_set").on(t.configSetId,t.code)]);
