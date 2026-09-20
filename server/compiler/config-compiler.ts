import "server-only";
import {hydrateMap01Loop} from "@/server/services/map01-loop";
import {enemyRuntimeSchema,enemySkillRuntimeSchema} from "@/server/domain/encounters/runtime";
import { readCultivators } from "@/server/services/cultivator-config";
import { validateCultivators } from "@/server/domain/cultivators/config";
import { readItemCatalog } from "@/server/services/item-config";
import { validateCatalog } from "@/server/domain/items/config";
import { skillDefinitionSchema, validateSkillReferences, type SkillDefinition } from "@/server/domain/skills/config";
import { readProductionSource } from "@/server/services/config-production";

import { and, asc, eq, inArray } from "drizzle-orm";
import type { AnyMySqlColumn, AnyMySqlTable } from "drizzle-orm/mysql-core";
import {
  buildings, buildingLevels, careerGrowths, careers, careerSkills, combatParameters,
  encounterMembers, encounters, enemies, enemySkills, expeditionItemRules, expeditionRules,
  foodRestRules, gameAssets, gameParameters, heroTemplates, heroTemplateSkills, i18nTexts,
  levelCosts, lootPoolEntries, lootPools, mapDefinitions, mapExpeditionRules, mapObjectPlacements,
  mapObjectPrototypes, newPlayerPresets, productionJobs, productionRules, realms, rewardPackEntries,
  rewardPacks, skillAiRules, skillEffects, skills, spiritualRoots, statusEffects, storageLevels,
} from "@/db/schema";
import { database } from "@/server/db/client";
import { compileJsonArtifact } from "./canonical-json";

export const releaseModuleCodes = ["base", "progression", "combat", "economy", "expedition", "maps"] as const;
export type ReleaseModuleCode = typeof releaseModuleCodes[number];
type QueryExecutor = typeof database;

export async function compileConfigModules(db: QueryExecutor, configSetId: string, schemaVersion: number, sourceRevision: number) {
  const productionSource=await readProductionSource(db,configSetId);
  const [assets, rewardPackRows, lootPoolRows, careerRows, heroRows, skillRows, enemyRows, encounterRows, buildingRows, mapRows, prototypeRows] = await Promise.all([
    db.select().from(gameAssets).where(and(eq(gameAssets.configSetId, configSetId), eq(gameAssets.status, "active"))).orderBy(gameAssets.code),
    db.select().from(rewardPacks).where(and(eq(rewardPacks.configSetId, configSetId), eq(rewardPacks.status, "active"))).orderBy(rewardPacks.code),
    db.select().from(lootPools).where(and(eq(lootPools.configSetId, configSetId), eq(lootPools.status, "active"))).orderBy(lootPools.code),
    db.select().from(careers).where(and(eq(careers.configSetId, configSetId), eq(careers.status, "active"))).orderBy(careers.code),
    db.select().from(heroTemplates).where(and(eq(heroTemplates.configSetId, configSetId), eq(heroTemplates.status, "active"))).orderBy(heroTemplates.code),
    db.select().from(skills).where(and(eq(skills.configSetId, configSetId), eq(skills.status, "active"))).orderBy(skills.code),
    db.select().from(enemies).where(and(eq(enemies.configSetId, configSetId), eq(enemies.status, "active"))).orderBy(enemies.code),
    db.select().from(encounters).where(and(eq(encounters.configSetId, configSetId), eq(encounters.status, "active"))).orderBy(encounters.code),
    db.select().from(buildings).where(and(eq(buildings.configSetId, configSetId), eq(buildings.status, "active"))).orderBy(buildings.code),
    db.select().from(mapDefinitions).where(and(eq(mapDefinitions.configSetId, configSetId), eq(mapDefinitions.status, "active"))).orderBy(mapDefinitions.code),
    db.select().from(mapObjectPrototypes).where(and(eq(mapObjectPrototypes.configSetId, configSetId), eq(mapObjectPrototypes.status, "active"))).orderBy(mapObjectPrototypes.code),
  ]);

  const codeByAssetId = codeMap(assets);
  for(const row of [...enemyRows,...encounterRows])if(row.design?.implementationStatus==="design_only")throw new Error(`${row.code} 尚为设计草稿，不能编译为可执行战斗配置`);
  const codeByRewardPackId = codeMap(rewardPackRows);
  const codeByLootPoolId = codeMap(lootPoolRows);
  const codeByCareerId = codeMap(careerRows);
  const codeByRootId = codeMap(await db.select().from(spiritualRoots).where(and(eq(spiritualRoots.configSetId, configSetId), eq(spiritualRoots.status, "active"))).orderBy(spiritualRoots.code));
  const codeByRealmId = codeMap(await db.select().from(realms).where(and(eq(realms.configSetId, configSetId), eq(realms.status, "active"))).orderBy(realms.code));
  const codeBySkillId = codeMap(skillRows);
  const codeByEnemyId = codeMap(enemyRows);
  const codeByEncounterId = codeMap(encounterRows);
  const codeByPrototypeId = codeMap(prototypeRows);

  const activeIds = {
    assets: assets.map((row) => row.id), rewardPacks: rewardPackRows.map((row) => row.id), lootPools: lootPoolRows.map((row) => row.id),
    careers: careerRows.map((row) => row.id), heroes: heroRows.map((row) => row.id), skills: skillRows.map((row) => row.id),
    enemies: enemyRows.map((row) => row.id), encounters: encounterRows.map((row) => row.id), buildings: buildingRows.map((row) => row.id), maps: mapRows.map((row) => row.id),
  };

  const [i18n, parameters, rewardEntries, lootEntries, roots, realmRows, costs, growths, careerSkillRows, heroSkillRows,
    skillEffectRows, skillAiRows, statusRows, enemySkillRows, encounterMemberRows, combatRules,
    productionRuleRows, jobRows, buildingLevelRows, storageRows, expeditionRuleRows, expeditionItemRows, foodRows,
    presetRows, mapRuleRows, placementRows] = await Promise.all([
    db.select().from(i18nTexts).where(and(eq(i18nTexts.configSetId, configSetId), eq(i18nTexts.status, "active"))).orderBy(i18nTexts.code, i18nTexts.locale),
    db.select().from(gameParameters).where(and(eq(gameParameters.configSetId, configSetId), eq(gameParameters.status, "active"))).orderBy(gameParameters.code),
    selectChildren(db, rewardPackEntries, rewardPackEntries.rewardPackId, activeIds.rewardPacks, rewardPackEntries.sortOrder),
    selectChildren(db, lootPoolEntries, lootPoolEntries.lootPoolId, activeIds.lootPools, lootPoolEntries.sortOrder),
    db.select().from(spiritualRoots).where(and(eq(spiritualRoots.configSetId, configSetId), eq(spiritualRoots.status, "active"))).orderBy(spiritualRoots.code),
    db.select().from(realms).where(and(eq(realms.configSetId, configSetId), eq(realms.status, "active"))).orderBy(realms.code),
    db.select().from(levelCosts).where(eq(levelCosts.configSetId, configSetId)).orderBy(levelCosts.level),
    selectChildren(db, careerGrowths, careerGrowths.careerId, activeIds.careers, careerGrowths.careerId),
    selectChildren(db, careerSkills, careerSkills.careerId, activeIds.careers, careerSkills.slotIndex),
    selectChildren(db, heroTemplateSkills, heroTemplateSkills.heroTemplateId, activeIds.heroes, heroTemplateSkills.slotIndex),
    selectChildren(db, skillEffects, skillEffects.skillId, activeIds.skills, skillEffects.orderIndex),
    selectChildren(db, skillAiRules, skillAiRules.skillId, activeIds.skills, skillAiRules.priority),
    db.select().from(statusEffects).where(and(eq(statusEffects.configSetId, configSetId), eq(statusEffects.status, "active"))).orderBy(statusEffects.code),
    selectChildren(db, enemySkills, enemySkills.enemyId, activeIds.enemies, enemySkills.slotIndex),
    selectChildren(db, encounterMembers, encounterMembers.encounterId, activeIds.encounters, encounterMembers.memberIndex),
    db.select().from(combatParameters).where(eq(combatParameters.configSetId, configSetId)).orderBy(combatParameters.code),
    db.select().from(productionRules).where(eq(productionRules.configSetId, configSetId)).orderBy(productionRules.code),
    db.select().from(productionJobs).where(and(eq(productionJobs.configSetId, configSetId), eq(productionJobs.status, "active"))).orderBy(productionJobs.code),
    selectChildren(db, buildingLevels, buildingLevels.buildingId, activeIds.buildings, buildingLevels.level),
    db.select().from(storageLevels).where(eq(storageLevels.configSetId, configSetId)).orderBy(storageLevels.level, storageLevels.assetId),
    db.select().from(expeditionRules).where(eq(expeditionRules.configSetId, configSetId)).orderBy(expeditionRules.code),
    db.select().from(expeditionItemRules).where(eq(expeditionItemRules.configSetId, configSetId)).orderBy(expeditionItemRules.sortOrder, expeditionItemRules.assetId),
    db.select().from(foodRestRules).where(eq(foodRestRules.configSetId, configSetId)).orderBy(foodRestRules.sortOrder, foodRestRules.assetId),
    db.select().from(newPlayerPresets).where(and(eq(newPlayerPresets.configSetId, configSetId), eq(newPlayerPresets.status, "active"))).orderBy(newPlayerPresets.code),
    selectChildren(db, mapExpeditionRules, mapExpeditionRules.mapId, activeIds.maps, mapExpeditionRules.mapId),
    selectChildren(db, mapObjectPlacements, mapObjectPlacements.mapId, activeIds.maps, mapObjectPlacements.instanceCode),
  ]);

  const catalog = await readItemCatalog(db, configSetId);
  if(productionSource&&(productionRuleRows.length||jobRows.length||storageRows.length))throw new Error("同一配置集不能同时维护资源服务和旧生产表两套规则");
  if(productionSource)for(const code of productionSource.rules.jobs.map(j=>j.code))if(!assets.some(a=>a.code===code))throw new Error(`生产资源引用不存在：${code}`);
  const itemErrors = validateCatalog(catalog);
  if (itemErrors.length) throw new Error(itemErrors.join("；"));
  const activeItem = <T extends {status:string;revision:number}>(rows:T[]) => rows.filter(r=>r.status==="active").map(row => omitMeta(row, ["revision"]));
  const cultivators = await readCultivators(db, configSetId);
  const cultivatorErrors = validateCultivators(cultivators,true);
  if(cultivatorErrors.length) throw new Error(cultivatorErrors.join("；"));
  const typedSkills:SkillDefinition[]=[];
  for(const row of skillRows)if(row.mechanics)typedSkills.push(skillDefinitionSchema.parse({code:row.code,name:row.nameKey,damageKind:row.damageKind,targetType:row.targetType,ignoreTaunt:row.ignoreTaunt,baseIntervalTicks:row.baseIntervalTicks,castTicks:row.castTicks,cooldownTicks:row.cooldownTicks,primaryAttribute:row.primaryAttribute,primaryPercent:row.primaryPercent,secondaryAttribute:row.secondaryAttribute,secondaryPercent:row.secondaryPercent,mechanics:row.mechanics}));
  const skillReferenceErrors=validateSkillReferences(typedSkills);
  if(skillReferenceErrors.length)throw new Error(skillReferenceErrors.join("；"));
  for(const row of skillRows)if(row.enemyRuntime)enemySkillRuntimeSchema.parse(row.enemyRuntime);
  for(const row of enemyRows)if(row.runtime)enemyRuntimeSchema.parse(row.runtime);
  const hasSkillMechanics=skillRows.some(row=>row.mechanics);
  for(const career of cultivators.careers.filter(c=>c.status==="active"&&c.tier===2))for(const slot of career.skills){
    const skill=skillRows.find(s=>s.code===slot.code);
    if(hasSkillMechanics&&!skill?.mechanics?.mastery)throw new Error(`${career.code}/${slot.code} 缺少精通配置`);
  }
  const loopParameter=parameters.find(p=>p.code==="map01_loop");
  const map01Loop=loopParameter?await hydrateMap01Loop(db,configSetId,loopParameter.jsonValue):null;
  const header = { schemaVersion, sourceRevision };
  const modules: Record<ReleaseModuleCode, unknown> = {
    base: { ...header,
      itemDefinitions: activeItem(catalog.items),
      marketConfig:catalog.market?omitMeta(catalog.market,["revision"]):null,
      marketRuntimeEnabled:false,
      itemQualities: activeItem(catalog.qualities),
      itemQualitySchemes: activeItem(catalog.schemes),
      i18n: i18n.map(row => omitMeta(row, ["id", "configSetId", "revision"])),
      assets: assets.map(row => omitMeta(row, ["id", "configSetId", "revision"])),
      parameters: parameters.map(row => omitMeta(row, ["id", "configSetId", "revision"])),
      rewardPacks: rewardPackRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "revision"]), entries: rewardEntries.filter(entry => entry.rewardPackId === row.id).map(entry => ({ ...omitMeta(entry, ["id", "rewardPackId"]), assetCode: requireCode(codeByAssetId, entry.assetId, "reward asset") })) })),
      lootPools: lootPoolRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "revision"]), entries: lootEntries.filter(entry => entry.lootPoolId === row.id).map(entry => ({ ...omitMeta(entry, ["id", "lootPoolId", "assetId", "rewardPackId"]), assetCode: optionalCode(codeByAssetId, entry.assetId), rewardPackCode: optionalCode(codeByRewardPackId, entry.rewardPackId) })) })),
    },
    progression: { ...header,
      ...(cultivators.rules ? {cultivatorConfigVersion:2, cultivatorRuntimeEnabled:false, cultivatorRules:omitMeta(cultivators.rules,["revision"]),careerRoutes:cultivators.routes.filter(r=>r.status==="active").map(r=>omitMeta(r,["revision"]))} : {}),
      careers: careerRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "revision"]), growth: omitMeta(growths.find(item => item.careerId === row.id) ?? null, ["id", "careerId"]), skills: careerSkillRows.filter(item => item.careerId === row.id).map(item => ({ ...omitMeta(item, ["id", "careerId", "skillId"]), skillCode: requireCode(codeBySkillId, item.skillId, "career skill"), ...(hasSkillMechanics ? {proficiency: row.tier === 2 ? "mastery" : "base"} : {}) })) })),
      spiritualRoots: roots.map(row => omitMeta(row, ["id", "configSetId", "revision"])), realms: realmRows.map(row => omitMeta(row, ["id", "configSetId", "revision"])),
      levelCosts: costs.map(row => omitMeta(row, ["id", "configSetId"])),
      heroTemplates: heroRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "revision", "careerId", "spiritualRootId", "initialRealmId"]), careerCode: requireCode(codeByCareerId, row.careerId, "hero career"), spiritualRootCode: requireCode(codeByRootId, row.spiritualRootId, "hero root"), initialRealmCode: requireCode(codeByRealmId, row.initialRealmId, "hero realm"), skills: heroSkillRows.filter(item => item.heroTemplateId === row.id).map(item => ({ slotIndex: item.slotIndex, skillCode: requireCode(codeBySkillId, item.skillId, "hero skill") })) })),
      newPlayerPresets: presetRows.map(row => omitMeta(row, ["id", "configSetId", "revision"])),
    },
    combat: { ...header,
      map01Loop,
      ...(hasSkillMechanics?{skillConfigVersion:2,skillRuntimeEnabled:false}:{}),
      skills: skillRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "revision"]), effects: skillEffectRows.filter(item => item.skillId === row.id).map(item => omitMeta(item, ["id", "skillId"])), aiRules: skillAiRows.filter(item => item.skillId === row.id).map(item => omitMeta(item, ["id", "skillId"])) })),
      statusEffects: statusRows.map(row => omitMeta(row, ["id", "configSetId", "revision"])),
      enemies: enemyRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "revision"]), skills: enemySkillRows.filter(item => item.enemyId === row.id).map(item => ({ ...omitMeta(item, ["id", "enemyId", "skillId"]), skillCode: requireCode(codeBySkillId, item.skillId, "enemy skill") })) })),
      encounters: encounterRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "revision", "firstClearRewardPackId", "repeatRewardPackId", "lootPoolId"]), firstClearRewardPackCode: optionalCode(codeByRewardPackId, row.firstClearRewardPackId), repeatRewardPackCode: optionalCode(codeByRewardPackId, row.repeatRewardPackId), lootPoolCode: optionalCode(codeByLootPoolId, row.lootPoolId), members: encounterMemberRows.filter(item => item.encounterId === row.id).map(item => ({ ...omitMeta(item, ["id", "encounterId", "enemyId"]), enemyCode: requireCode(codeByEnemyId, item.enemyId, "encounter enemy") })) })),
      parameters: combatRules.map(row => omitMeta(row, ["id", "configSetId"])),
    },
    economy: { ...header,
      ...(productionSource?{productionConfigVersion:3,productionSource:productionSource.binding,productionConfig:productionSource.rules,productionRuntime:"resource_service"}:{}),
      craftingRecipes: activeItem(catalog.recipes.filter(r=>r.availability==="ready")),
      rules: productionRuleRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "recruitCostAssetId"]), recruitCostAssetCode: requireCode(codeByAssetId, row.recruitCostAssetId, "recruit asset") })),
      buildings: buildingRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "revision"]), levels: buildingLevelRows.filter(item => item.buildingId === row.id).map(item => ({ ...omitMeta(item, ["id", "buildingId", "upgradeCostAssetId"]), upgradeCostAssetCode: optionalCode(codeByAssetId, item.upgradeCostAssetId) })) })),
      jobs: jobRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "revision", "outputAssetId", "upkeepAssetId"]), outputAssetCode: requireCode(codeByAssetId, row.outputAssetId, "job output asset"), upkeepAssetCode: optionalCode(codeByAssetId, row.upkeepAssetId) })),
      storageLevels: storageRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "assetId", "upgradeCostAssetId"]), assetCode: requireCode(codeByAssetId, row.assetId, "storage asset"), upgradeCostAssetCode: optionalCode(codeByAssetId, row.upgradeCostAssetId) })),
    },
    expedition: { ...header,
      rules: expeditionRuleRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "returnTalismanAssetId"]), returnTalismanAssetCode: optionalCode(codeByAssetId, row.returnTalismanAssetId) })),
      items: expeditionItemRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "assetId"]), assetCode: requireCode(codeByAssetId, row.assetId, "expedition asset") })),
      foodRest: foodRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "assetId"]), assetCode: requireCode(codeByAssetId, row.assetId, "food asset") })),
    },
    maps: { ...header,
      maps: mapRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "revision"]), expeditionRule: omitMeta(mapRuleRows.find(item => item.mapId === row.id) ?? null, ["id", "mapId"]), placements: placementRows.filter(item => item.mapId === row.id).map(item => ({ ...omitMeta(item, ["id", "mapId", "prototypeId", "firstRewardPackId", "repeatRewardPackId"]), prototypeCode: requireCode(codeByPrototypeId, item.prototypeId, "map object prototype"), firstRewardPackCode: optionalCode(codeByRewardPackId, item.firstRewardPackId), repeatRewardPackCode: optionalCode(codeByRewardPackId, item.repeatRewardPackId) })) })),
      prototypes: prototypeRows.map(row => ({ ...omitMeta(row, ["id", "configSetId", "revision", "encounterId", "rewardPackId"]), encounterCode: optionalCode(codeByEncounterId, row.encounterId), rewardPackCode: optionalCode(codeByRewardPackId, row.rewardPackId) })),
    },
  };

  return releaseModuleCodes.map(moduleCode => ({ moduleCode, moduleSchemaVersion: schemaVersion, ...compileJsonArtifact(modules[moduleCode]) }));
}

function codeMap(rows: { id: string; code: string }[]) { return new Map(rows.map(row => [row.id, row.code])); }
function optionalCode(map: Map<string, string>, id: string | null) { return id ? requireCode(map, id, "reference") : null; }
function requireCode(map: Map<string, string>, id: string, label: string) {
  const code = map.get(id);
  if (!code) throw new Error(`Missing compiled ${label}: ${id}`);
  return code;
}
function omitMeta<T>(row: T, keys: string[]): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  return Object.fromEntries(Object.entries(row as Record<string, unknown>).filter(([key]) => !keys.includes(key) && key !== "createdAt" && key !== "updatedAt"));
}
async function selectChildren<TTable extends AnyMySqlTable>(db: QueryExecutor, table: TTable, parentColumn: AnyMySqlColumn, parentIds: string[], orderColumn: AnyMySqlColumn): Promise<TTable["$inferSelect"][]> {
  if (!parentIds.length) return [];
  return db.select().from(table).where(inArray(parentColumn, parentIds)).orderBy(asc(parentColumn), asc(orderColumn)) as Promise<TTable["$inferSelect"][]>;
}
