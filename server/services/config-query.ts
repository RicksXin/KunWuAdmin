import "server-only";

import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  buildings,
  careers,
  combatParameters,
  configImportIssues,
  configImportRuns,
  configSets,
  encounters,
  enemies,
  expeditionRules,
  gameAssets,
  gameParameters,
  heroTemplates,
  i18nTexts,
  lootPools,
  mapDefinitions,
  mapObjectPlacements,
  mapObjectPrototypes,
  newPlayerPresets,
  productionJobs,
  productionRules,
  realms,
  rewardPacks,
  skills,
  spiritualRoots,
  statusEffects,
} from "@/db/schema";
import { database } from "@/server/db/client";

export const configModuleSchema = z.enum(["base", "progression", "combat", "economy", "expedition"]);
export type ConfigModuleCode = z.infer<typeof configModuleSchema>;

export class ConfigSetNotFoundError extends Error {}

async function getConfigSet(code: string) {
  const [configSet] = await database.select({
    id: configSets.id,
    code: configSets.code,
    name: configSets.name,
    status: configSets.status,
    schemaVersion: configSets.schemaVersion,
    currentRevision: configSets.currentRevision,
    updatedAt: configSets.updatedAt,
  }).from(configSets).where(eq(configSets.code, code)).limit(1);
  if (!configSet) throw new ConfigSetNotFoundError(`Config set ${code} was not found`);
  return configSet;
}

const value = (rows: { value: number }[]) => Number(rows[0]?.value ?? 0);

export async function getConfigOverview(configSetCode: string) {
  const configSet = await getConfigSet(configSetCode);
  const availableSetsPromise = database.select({
    code: configSets.code,
    name: configSets.name,
    status: configSets.status,
    currentRevision: configSets.currentRevision,
  }).from(configSets).orderBy(configSets.code);

  const latestImportPromise = database.select({
    id: configImportRuns.id,
    status: configImportRuns.status,
    sourceKind: configImportRuns.sourceKind,
    sourceRoot: configImportRuns.sourceRoot,
    summary: configImportRuns.summary,
    startedAt: configImportRuns.startedAt,
    finishedAt: configImportRuns.finishedAt,
  }).from(configImportRuns).where(andImportStatuses(configSet.id)).orderBy(desc(configImportRuns.createdAt)).limit(1);

  const countPromises = {
    i18n: database.select({ value: count() }).from(i18nTexts).where(eq(i18nTexts.configSetId, configSet.id)),
    assets: database.select({ value: count() }).from(gameAssets).where(eq(gameAssets.configSetId, configSet.id)),
    rewardPacks: database.select({ value: count() }).from(rewardPacks).where(eq(rewardPacks.configSetId, configSet.id)),
    lootPools: database.select({ value: count() }).from(lootPools).where(eq(lootPools.configSetId, configSet.id)),
    parameters: database.select({ value: count() }).from(gameParameters).where(eq(gameParameters.configSetId, configSet.id)),
    careers: database.select({ value: count() }).from(careers).where(eq(careers.configSetId, configSet.id)),
    roots: database.select({ value: count() }).from(spiritualRoots).where(eq(spiritualRoots.configSetId, configSet.id)),
    realms: database.select({ value: count() }).from(realms).where(eq(realms.configSetId, configSet.id)),
    heroes: database.select({ value: count() }).from(heroTemplates).where(eq(heroTemplates.configSetId, configSet.id)),
    presets: database.select({ value: count() }).from(newPlayerPresets).where(eq(newPlayerPresets.configSetId, configSet.id)),
    skills: database.select({ value: count() }).from(skills).where(eq(skills.configSetId, configSet.id)),
    statuses: database.select({ value: count() }).from(statusEffects).where(eq(statusEffects.configSetId, configSet.id)),
    enemies: database.select({ value: count() }).from(enemies).where(eq(enemies.configSetId, configSet.id)),
    encounters: database.select({ value: count() }).from(encounters).where(eq(encounters.configSetId, configSet.id)),
    combatParameters: database.select({ value: count() }).from(combatParameters).where(eq(combatParameters.configSetId, configSet.id)),
    buildings: database.select({ value: count() }).from(buildings).where(eq(buildings.configSetId, configSet.id)),
    productionJobs: database.select({ value: count() }).from(productionJobs).where(eq(productionJobs.configSetId, configSet.id)),
    productionRules: database.select({ value: count() }).from(productionRules).where(eq(productionRules.configSetId, configSet.id)),
    expeditionRules: database.select({ value: count() }).from(expeditionRules).where(eq(expeditionRules.configSetId, configSet.id)),
    maps: database.select({ value: count() }).from(mapDefinitions).where(eq(mapDefinitions.configSetId, configSet.id)),
    objectPrototypes: database.select({ value: count() }).from(mapObjectPrototypes).where(eq(mapObjectPrototypes.configSetId, configSet.id)),
  };

  const [availableSets, latestImports, countsEntries] = await Promise.all([
    availableSetsPromise,
    latestImportPromise,
    Promise.all(Object.entries(countPromises).map(async ([key, promise]) => [key, value(await promise)] as const)),
  ]);
  const counts = Object.fromEntries(countsEntries) as Record<keyof typeof countPromises, number>;
  const latestImport = latestImports[0] ?? null;
  const recentIssues = latestImport
    ? await database.select({
        severity: configImportIssues.severity,
        conflictType: configImportIssues.conflictType,
        entityType: configImportIssues.entityType,
        entityCode: configImportIssues.entityCode,
        candidateValues: configImportIssues.candidateValues,
        resolutionStatus: configImportIssues.resolutionStatus,
        createdAt: configImportIssues.createdAt,
      }).from(configImportIssues).where(eq(configImportIssues.importRunId, latestImport.id))
        .orderBy(desc(configImportIssues.severity), configImportIssues.entityType, configImportIssues.entityCode)
    : [];
  const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
  recentIssues.sort((left, right) =>
    (severityOrder[left.severity] ?? 9) - (severityOrder[right.severity] ?? 9)
    || String(left.entityType ?? "").localeCompare(String(right.entityType ?? ""))
    || String(left.entityCode ?? "").localeCompare(String(right.entityCode ?? "")),
  );

  return {
    configSet,
    availableSets,
    latestImport,
    issueSummary: {
      total: recentIssues.length,
      errors: recentIssues.filter((issue) => issue.severity === "error").length,
      warnings: recentIssues.filter((issue) => issue.severity === "warning").length,
      unresolved: recentIssues.filter((issue) => issue.resolutionStatus === "unresolved").length,
    },
    modules: [
      { code: "base", name: "基础资源", count: counts.i18n + counts.assets + counts.rewardPacks + counts.lootPools + counts.parameters, detail: `${counts.assets} 资源 · ${counts.i18n} 文本 · ${counts.rewardPacks} 奖励包 · ${counts.lootPools} 掉落池` },
      { code: "progression", name: "修士成长", count: counts.careers + counts.roots + counts.realms + counts.heroes + counts.presets, detail: `${counts.careers} 职业 · ${counts.roots} 灵根 · ${counts.realms} 境界 · ${counts.heroes} 修士` },
      { code: "combat", name: "技能战斗", count: counts.skills + counts.statuses + counts.enemies + counts.encounters + counts.combatParameters, detail: `${counts.skills} 技能 · ${counts.statuses} 状态 · ${counts.enemies} 敌人 · ${counts.encounters} 遭遇` },
      { code: "economy", name: "营地经济", count: counts.buildings + counts.productionJobs + counts.productionRules, detail: `${counts.buildings} 建筑 · ${counts.productionJobs} 生产岗位` },
      { code: "expedition", name: "出征地图", count: counts.expeditionRules + counts.maps + counts.objectPrototypes, detail: `${counts.maps} 地图 · ${counts.objectPrototypes} 对象原型` },
    ],
    recentIssues,
  };
}

function andImportStatuses(configSetId: string) {
  return and(
    eq(configImportRuns.configSetId, configSetId),
    inArray(configImportRuns.status, ["completed", "completed_with_issues"]),
  );
}

export async function listConfigModuleEntities(configSetCode: string, module: ConfigModuleCode) {
  const configSet = await getConfigSet(configSetCode);
  const setId = configSet.id;

  if (module === "base") {
    return {
      configSet: configSet.code,
      module,
      groups: [
        { code: "assets", name: "资源与物品", rows: await database.select({ code: gameAssets.code, nameKey: gameAssets.nameKey, type: gameAssets.assetType, weight: gameAssets.weight, status: gameAssets.status }).from(gameAssets).where(eq(gameAssets.configSetId, setId)).orderBy(gameAssets.assetType, gameAssets.code) },
        { code: "rewardPacks", name: "奖励包", rows: await database.select({ code: rewardPacks.code, nameKey: rewardPacks.nameKey, type: rewardPacks.grantMode, status: rewardPacks.status }).from(rewardPacks).where(eq(rewardPacks.configSetId, setId)).orderBy(rewardPacks.code) },
      ],
    };
  }
  if (module === "progression") {
    return {
      configSet: configSet.code,
      module,
      groups: [
        { code: "careers", name: "职业", rows: await database.select({ code: careers.code, nameKey: careers.nameKey, type: careers.primaryAttribute, level: careers.tier, status: careers.status }).from(careers).where(eq(careers.configSetId, setId)).orderBy(careers.sortOrder) },
        { code: "roots", name: "灵根", rows: await database.select({ code: spiritualRoots.code, nameKey: spiritualRoots.nameKey, basePercent: spiritualRoots.basePercent, growthPercent: spiritualRoots.growthPercent, status: spiritualRoots.status }).from(spiritualRoots).where(eq(spiritualRoots.configSetId, setId)).orderBy(spiritualRoots.rarityOrder) },
        { code: "realms", name: "境界", rows: await database.select({ code: realms.code, nameKey: realms.nameKey, minLevel: realms.minLevel, maxLevel: realms.maxLevel, status: realms.status }).from(realms).where(eq(realms.configSetId, setId)).orderBy(realms.orderIndex) },
        { code: "heroes", name: "初始修士", rows: await database.select({ code: heroTemplates.code, nameKey: heroTemplates.nameKey, level: heroTemplates.initialLevel, status: heroTemplates.status }).from(heroTemplates).where(eq(heroTemplates.configSetId, setId)).orderBy(heroTemplates.sortOrder) },
      ],
    };
  }
  if (module === "combat") {
    return {
      configSet: configSet.code,
      module,
      groups: [
        { code: "skills", name: "技能", editable: true, rows: await database.select({ code: skills.code, nameKey: skills.nameKey, type: skills.damageKind, target: skills.targetType, interval: skills.baseIntervalTicks, cooldown: skills.cooldownTicks, status: skills.status, revision: skills.revision }).from(skills).where(eq(skills.configSetId, setId)).orderBy(skills.sortOrder) },
        { code: "enemies", name: "敌人", rows: await database.select({ code: enemies.code, nameKey: enemies.nameKey, type: enemies.rank, hp: enemies.maxHp, status: enemies.status }).from(enemies).where(eq(enemies.configSetId, setId)).orderBy(enemies.sortOrder) },
        { code: "encounters", name: "遭遇", rows: await database.select({ code: encounters.code, type: encounters.encounterType, escapePercent: encounters.escapeEnemyHpPercent, status: encounters.status }).from(encounters).where(eq(encounters.configSetId, setId)).orderBy(encounters.sortOrder) },
      ],
    };
  }
  if (module === "economy") {
    return {
      configSet: configSet.code,
      module,
      groups: [
        { code: "buildings", name: "建筑", rows: await database.select({ code: buildings.code, nameKey: buildings.nameKey, level: buildings.initialLevel, maxLevel: buildings.maxLevel, status: buildings.status }).from(buildings).where(eq(buildings.configSetId, setId)).orderBy(buildings.sortOrder) },
        { code: "productionJobs", name: "生产岗位", rows: await database.select({ code: productionJobs.code, output: productionJobs.outputPerWorker, upkeep: productionJobs.upkeepPerWorker, shutdownPriority: productionJobs.shutdownPriority, status: productionJobs.status }).from(productionJobs).where(eq(productionJobs.configSetId, setId)).orderBy(productionJobs.sortOrder) },
      ],
    };
  }
  return {
    configSet: configSet.code,
    module,
    groups: [
      { code: "maps", name: "地图", rows: await database.select({ code: mapDefinitions.code, nameKey: mapDefinitions.nameKey, type: mapDefinitions.status, mapNumber: mapDefinitions.mapNumber, width: mapDefinitions.activeWidth, height: mapDefinitions.activeHeight }).from(mapDefinitions).where(eq(mapDefinitions.configSetId, setId)).orderBy(mapDefinitions.mapNumber) },
      { code: "objects", name: "地图对象原型", rows: await database.select({ code: mapObjectPrototypes.code, type: mapObjectPrototypes.kind, title: mapObjectPrototypes.title, refresh: mapObjectPrototypes.refreshType, status: mapObjectPrototypes.status }).from(mapObjectPrototypes).where(eq(mapObjectPrototypes.configSetId, setId)).orderBy(mapObjectPrototypes.sortOrder) },
      { code: "placements", name: "地图落点", rows: await database.select({ code: mapObjectPlacements.instanceCode, x: mapObjectPlacements.x, y: mapObjectPlacements.y }).from(mapObjectPlacements).innerJoin(mapDefinitions, eq(mapObjectPlacements.mapId, mapDefinitions.id)).where(eq(mapDefinitions.configSetId, setId)).orderBy(mapObjectPlacements.instanceCode) },
    ],
  };
}
