import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  buildings,
  careers,
  configImportIssues,
  configImportRuns,
  configSets,
  configValidationIssues,
  configValidationRuns,
  encounterMembers,
  encounters,
  enemies,
  expeditionRules,
  gameAssets,
  heroTemplates,
  mapDefinitions,
  mapObjectPlacements,
  newPlayerPresets,
  productionJobs,
  productionRules,
  realms,
  skills,
  spiritualRoots,
} from "@/db/schema";
import { database } from "@/server/db/client";
import { ConfigSetNotFoundError } from "./config-query";

export type ConfigIssue = {
  severity: "error" | "warning" | "info";
  moduleCode: string | null;
  entityType: string | null;
  entityCode: string | null;
  fieldPath: string | null;
  ruleCode: string;
  message: string;
  details?: Record<string, unknown>;
};

const attributes = new Set(["strength", "magic", "technique", "speed", "constitution", "armor", "resistance"]);
const damageKinds = new Set(["physical", "magical", "none"]);
const targetTypes = new Set(["SELF", "ALLY_ALL", "ALLY_LOWEST_HP", "ENEMY_SINGLE", "ENEMY_ALL", "ENEMY_LOWEST_HP", "ENEMY_RANDOM_MULTI"]);

export async function runConfigValidation(configSetCode: string) {
  return database.transaction(async (tx) => {
    const [configSet] = await tx.select({
      id: configSets.id,
      code: configSets.code,
      currentRevision: configSets.currentRevision,
    }).from(configSets).where(eq(configSets.code, configSetCode)).limit(1).for("update");
    if (!configSet) throw new ConfigSetNotFoundError(`Config set ${configSetCode} was not found`);

    const runId = uuidv7();
    const startedAt = new Date();
    await tx.insert(configValidationRuns).values({
      id: runId,
      configSetId: configSet.id,
      sourceRevision: configSet.currentRevision,
      status: "running",
      startedAt,
    });

    const issues: ConfigIssue[] = [];
    const add = (issue: ConfigIssue) => issues.push(issue);

    const realmRows = await tx.select({
      code: realms.code, orderIndex: realms.orderIndex, minLevel: realms.minLevel, maxLevel: realms.maxLevel,
    }).from(realms).where(and(eq(realms.configSetId, configSet.id), eq(realms.status, "active"))).orderBy(realms.orderIndex, realms.code);
    realmRows.forEach((realm, index) => {
      if (realm.minLevel > realm.maxLevel) add(issue("error", "progression", "realm", realm.code, "levelRange", "REALM_INVALID_RANGE", "境界最低等级不能高于最高等级", realm));
      if (index === 0 && realm.minLevel !== 1) add(issue("error", "progression", "realm", realm.code, "minLevel", "REALM_MUST_START_AT_ONE", "首个境界必须从 1 级开始", realm));
      const previous = realmRows[index - 1];
      if (previous && realm.minLevel !== previous.maxLevel + 1) add(issue("error", "progression", "realm", realm.code, "minLevel", "REALM_RANGE_NOT_CONTIGUOUS", `境界等级必须连续，预期从 ${previous.maxLevel + 1} 级开始`, { previous: previous.code, previousMax: previous.maxLevel, actualMin: realm.minLevel }));
    });

    const rootRows = await tx.select({
      code: spiritualRoots.code, rarityOrder: spiritualRoots.rarityOrder,
      basePercent: spiritualRoots.basePercent, growthPercent: spiritualRoots.growthPercent,
    }).from(spiritualRoots).where(and(eq(spiritualRoots.configSetId, configSet.id), eq(spiritualRoots.status, "active"))).orderBy(spiritualRoots.rarityOrder, spiritualRoots.code);
    rootRows.forEach((root, index) => {
      const previous = rootRows[index - 1];
      if (root.basePercent <= 0 || root.growthPercent <= 0) add(issue("error", "progression", "spiritual_root", root.code, "multipliers", "ROOT_MULTIPLIER_NOT_POSITIVE", "灵根倍率必须为正数", root));
      if (previous && (root.basePercent < previous.basePercent || root.growthPercent < previous.growthPercent)) add(issue("error", "progression", "spiritual_root", root.code, "multipliers", "ROOT_MULTIPLIER_NOT_MONOTONIC", "灵根倍率必须随稀有度单调不降", { previous, current: root }));
    });

    const skillRows = await tx.select({
      code: skills.code, damageKind: skills.damageKind, targetType: skills.targetType,
      baseIntervalTicks: skills.baseIntervalTicks, castTicks: skills.castTicks, cooldownTicks: skills.cooldownTicks,
      primaryAttribute: skills.primaryAttribute, primaryPercent: skills.primaryPercent,
      secondaryAttribute: skills.secondaryAttribute, secondaryPercent: skills.secondaryPercent,
    }).from(skills).where(and(eq(skills.configSetId, configSet.id), eq(skills.status, "active"))).orderBy(skills.code);
    skillRows.forEach((skill) => {
      if (!damageKinds.has(skill.damageKind)) add(issue("error", "combat", "skill", skill.code, "damageKind", "SKILL_DAMAGE_KIND_INVALID", "技能伤害类型不合法", { value: skill.damageKind }));
      if (!targetTypes.has(skill.targetType)) add(issue("error", "combat", "skill", skill.code, "targetType", "SKILL_TARGET_INVALID", "技能目标类型不合法", { value: skill.targetType }));
      if (skill.baseIntervalTicks <= 0 || skill.castTicks < 0 || skill.cooldownTicks < 0) add(issue("error", "combat", "skill", skill.code, "ticks", "SKILL_TICKS_INVALID", "技能 Tick 必须处于合法范围", skill));
      if ((skill.primaryAttribute && !attributes.has(skill.primaryAttribute)) || (skill.secondaryAttribute && !attributes.has(skill.secondaryAttribute))) add(issue("error", "combat", "skill", skill.code, "attributes", "SKILL_ATTRIBUTE_INVALID", "技能倍率只能引用冻结的七维属性", { primary: skill.primaryAttribute, secondary: skill.secondaryAttribute }));
      if (skill.primaryPercent < 0 || skill.secondaryPercent < 0 || skill.primaryPercent > 10000 || skill.secondaryPercent > 10000) add(issue("error", "combat", "skill", skill.code, "percent", "SKILL_MULTIPLIER_INVALID", "技能倍率必须在 0 到 10000 之间", skill));
      if (skill.damageKind !== "none" && (!skill.primaryAttribute || skill.primaryPercent <= 0)) add(issue("error", "combat", "skill", skill.code, "primaryPercent", "SKILL_DAMAGE_MULTIPLIER_MISSING", "伤害技能必须配置主属性正倍率", skill));
      if ((!skill.secondaryAttribute && skill.secondaryPercent !== 0) || (skill.secondaryAttribute && skill.secondaryPercent <= 0)) add(issue("error", "combat", "skill", skill.code, "secondaryPercent", "SKILL_SECONDARY_MULTIPLIER_INVALID", "技能副属性与副倍率必须同时配置", skill));
    });

    const encounterRows = await tx.select({ code: encounters.code, id: encounters.id })
      .from(encounters).where(and(eq(encounters.configSetId, configSet.id), eq(encounters.status, "active"))).orderBy(encounters.code);
    const encounterMemberRows = encounterRows.length ? await tx.select({
      encounterId: encounterMembers.encounterId, quantity: encounterMembers.quantity,
    }).from(encounterMembers).where(inArray(encounterMembers.encounterId, encounterRows.map((row) => row.id))) : [];
    const membersByEncounter = new Map<string, number>();
    encounterMemberRows.forEach((member) => membersByEncounter.set(member.encounterId, (membersByEncounter.get(member.encounterId) ?? 0) + (member.quantity > 0 ? member.quantity : 0)));
    encounterRows.forEach((encounter) => {
      if ((membersByEncounter.get(encounter.id) ?? 0) < 1) add(issue("error", "combat", "encounter", encounter.code, "members", "ENCOUNTER_HAS_NO_ENEMY", "启用的遭遇至少需要一个敌人"));
    });

    const jobRows = await tx.select({
      code: productionJobs.code, shutdownPriority: productionJobs.shutdownPriority,
      outputPerWorker: productionJobs.outputPerWorker, upkeepPerWorker: productionJobs.upkeepPerWorker,
    }).from(productionJobs).where(and(eq(productionJobs.configSetId, configSet.id), eq(productionJobs.status, "active"))).orderBy(productionJobs.shutdownPriority, productionJobs.code);
    const consumers = jobRows.filter((job) => job.upkeepPerWorker > 0);
    consumers.forEach((job) => {
      if (job.outputPerWorker <= 0) add(issue("error", "economy", "production_job", job.code, "outputPerWorker", "PRODUCTION_OUTPUT_NOT_POSITIVE", "生产岗位单工产出必须为正数", job));
      if (job.shutdownPriority === null) add(issue("error", "economy", "production_job", job.code, "shutdownPriority", "PRODUCTION_PRIORITY_MISSING", "有维护消耗的岗位必须配置停工顺序", job));
    });
    const priorities = consumers.flatMap((job) => job.shutdownPriority === null ? [] : [job.shutdownPriority]).sort((a, b) => a - b);
    priorities.forEach((priority, index) => {
      if (priority !== index) add(issue("error", "economy", "production_job", consumers.find((job) => job.shutdownPriority === priority)?.code ?? null, "shutdownPriority", "PRODUCTION_PRIORITY_NOT_CONTIGUOUS", "停工顺序必须从 0 开始且连续不重复", { priorities }));
    });

    const mapRows = await tx.select({
      id: mapDefinitions.id, code: mapDefinitions.code, activeWidth: mapDefinitions.activeWidth,
      activeHeight: mapDefinitions.activeHeight, entryX: mapDefinitions.entryX, entryY: mapDefinitions.entryY,
    }).from(mapDefinitions).where(and(eq(mapDefinitions.configSetId, configSet.id), eq(mapDefinitions.status, "active"))).orderBy(mapDefinitions.code);
    const placementRows = mapRows.length ? await tx.select({
      mapId: mapObjectPlacements.mapId, instanceCode: mapObjectPlacements.instanceCode,
      x: mapObjectPlacements.x, y: mapObjectPlacements.y,
    }).from(mapObjectPlacements).where(inArray(mapObjectPlacements.mapId, mapRows.map((row) => row.id))).orderBy(mapObjectPlacements.instanceCode) : [];
    const mapsById = new Map(mapRows.map((map) => [map.id, map]));
    mapRows.forEach((map) => {
      if (!map.activeWidth || !map.activeHeight || map.entryX === null || map.entryY === null || !inside(map.entryX, map.entryY, map.activeWidth, map.activeHeight)) add(issue("error", "maps", "map_definition", map.code, "entry", "MAP_ENTRY_OUT_OF_BOUNDS", "启用地图必须配置有效尺寸和范围内入口", map));
    });
    placementRows.forEach((placement) => {
      const map = mapsById.get(placement.mapId);
      if (map?.activeWidth && map.activeHeight && !inside(placement.x, placement.y, map.activeWidth, map.activeHeight)) add(issue("error", "maps", "map_object_placement", placement.instanceCode, "coordinate", "MAP_OBJECT_OUT_OF_BOUNDS", "地图对象坐标超出有效地图范围", { map: map.code, x: placement.x, y: placement.y }));
    });

    const [assetRows, careerRows, heroRows, enemyRows, buildingRows, productionRuleRows, expeditionRuleRows, presetRows] = await Promise.all([
      tx.select({ code: gameAssets.code }).from(gameAssets).where(and(eq(gameAssets.configSetId, configSet.id), eq(gameAssets.status, "active"))),
      tx.select({ code: careers.code }).from(careers).where(and(eq(careers.configSetId, configSet.id), eq(careers.status, "active"))),
      tx.select({ code: heroTemplates.code }).from(heroTemplates).where(and(eq(heroTemplates.configSetId, configSet.id), eq(heroTemplates.status, "active"))),
      tx.select({ code: enemies.code }).from(enemies).where(and(eq(enemies.configSetId, configSet.id), eq(enemies.status, "active"))),
      tx.select({ code: buildings.code }).from(buildings).where(and(eq(buildings.configSetId, configSet.id), eq(buildings.status, "active"))),
      tx.select({ code: productionRules.code }).from(productionRules).where(eq(productionRules.configSetId, configSet.id)),
      tx.select({ code: expeditionRules.code }).from(expeditionRules).where(eq(expeditionRules.configSetId, configSet.id)),
      tx.select({ code: newPlayerPresets.code, payload: newPlayerPresets.payload }).from(newPlayerPresets).where(and(eq(newPlayerPresets.configSetId, configSet.id), eq(newPlayerPresets.status, "active"))),
    ]);
    const references = {
      assets: new Set(assetRows.map((row) => row.code)), careers: new Set(careerRows.map((row) => row.code)),
      roots: new Set(rootRows.map((row) => row.code)), realms: new Set(realmRows.map((row) => row.code)),
      heroes: new Set(heroRows.map((row) => row.code)), skills: new Set(skillRows.map((row) => row.code)),
      buildings: new Set(buildingRows.map((row) => row.code)), jobs: new Set(jobRows.map((row) => row.code)),
    };
    presetRows.forEach((preset) => validatePreset(preset.code, preset.payload, references, add));

    const missingCollections = [
      ["base", "game_asset", assetRows.length],
      ["progression", "career", careerRows.length],
      ["progression", "spiritual_root", rootRows.length],
      ["progression", "realm", realmRows.length],
      ["progression", "hero_template", heroRows.length],
      ["progression", "new_player_preset", presetRows.length],
      ["combat", "skill", skillRows.length],
      ["combat", "enemy", enemyRows.length],
      ["combat", "encounter", encounterRows.length],
      ["economy", "building", buildingRows.length],
      ["economy", "production_rule", productionRuleRows.length],
      ["economy", "production_job", jobRows.length],
      ["expedition", "expedition_rule", expeditionRuleRows.length],
      ["maps", "map_definition", mapRows.length],
    ] as const;
    missingCollections.forEach(([moduleCode, entityType, size]) => {
      if (size === 0) add(issue("error", moduleCode, "config_set", configSet.code, entityType, "REQUIRED_COLLECTION_EMPTY", `发布所需配置集合为空：${entityType}`, { entityType }));
    });

    const [latestImport] = await tx.select({ id: configImportRuns.id }).from(configImportRuns)
      .where(and(eq(configImportRuns.configSetId, configSet.id), inArray(configImportRuns.status, ["completed", "completed_with_issues"])))
      .orderBy(desc(configImportRuns.createdAt)).limit(1);
    if (latestImport) {
      const importedIssues = await tx.select({
        severity: configImportIssues.severity,
        conflictType: configImportIssues.conflictType,
        entityType: configImportIssues.entityType,
        entityCode: configImportIssues.entityCode,
        candidateValues: configImportIssues.candidateValues,
      }).from(configImportIssues).where(and(eq(configImportIssues.importRunId, latestImport.id), eq(configImportIssues.resolutionStatus, "unresolved")))
        .orderBy(configImportIssues.severity, configImportIssues.conflictType, configImportIssues.entityCode);
      importedIssues.forEach((imported) => add({
        severity: imported.severity === "error" ? "error" : imported.severity === "info" ? "info" : "warning",
        moduleCode: importModule(imported.entityType), entityType: imported.entityType, entityCode: imported.entityCode,
        fieldPath: null, ruleCode: `IMPORT_${imported.conflictType.toUpperCase()}`,
        message: imported.severity === "error" ? "存在未解决的阻断级导入冲突" : "存在尚未确认的导入候选值",
        details: asRecord(imported.candidateValues),
      }));
    }

    const errorCount = issues.filter((item) => item.severity === "error").length;
    const warningCount = issues.filter((item) => item.severity === "warning").length;
    const infoCount = issues.filter((item) => item.severity === "info").length;
    if (issues.length) await tx.insert(configValidationIssues).values(issues.map((item) => ({ validationRunId: runId, ...item })));
    const finishedAt = new Date();
    const status = errorCount ? "failed" : warningCount ? "passed_with_warnings" : "passed";
    await tx.update(configValidationRuns).set({ status, errorCount, warningCount, infoCount, finishedAt }).where(eq(configValidationRuns.id, runId));
    return { id: runId, configSet: configSet.code, sourceRevision: configSet.currentRevision, status, errorCount, warningCount, infoCount, startedAt, finishedAt, issues };
  });
}

export async function getLatestConfigValidation(configSetCode: string) {
  const [configSet] = await database.select({ id: configSets.id, code: configSets.code, currentRevision: configSets.currentRevision })
    .from(configSets).where(eq(configSets.code, configSetCode)).limit(1);
  if (!configSet) throw new ConfigSetNotFoundError(`Config set ${configSetCode} was not found`);
  const [run] = await database.select().from(configValidationRuns).where(eq(configValidationRuns.configSetId, configSet.id)).orderBy(desc(configValidationRuns.createdAt)).limit(1);
  if (!run) return { configSet: configSet.code, currentRevision: configSet.currentRevision, run: null, issues: [] };
  const runIssues = await database.select({
    severity: configValidationIssues.severity, moduleCode: configValidationIssues.moduleCode,
    entityType: configValidationIssues.entityType, entityCode: configValidationIssues.entityCode,
    fieldPath: configValidationIssues.fieldPath, ruleCode: configValidationIssues.ruleCode,
    message: configValidationIssues.message, details: configValidationIssues.details,
  }).from(configValidationIssues).where(eq(configValidationIssues.validationRunId, run.id))
    .orderBy(configValidationIssues.severity, configValidationIssues.moduleCode, configValidationIssues.ruleCode, configValidationIssues.entityCode);
  return { configSet: configSet.code, currentRevision: configSet.currentRevision, run, stale: run.sourceRevision !== configSet.currentRevision, issues: runIssues };
}

function issue(severity: ConfigIssue["severity"], moduleCode: string, entityType: string, entityCode: string | null, fieldPath: string, ruleCode: string, message: string, details?: Record<string, unknown>): ConfigIssue {
  return { severity, moduleCode, entityType, entityCode, fieldPath, ruleCode, message, details };
}

function inside(x: number, y: number, width: number, height: number) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

type ReferenceSets = { assets: Set<string>; careers: Set<string>; roots: Set<string>; realms: Set<string>; heroes: Set<string>; skills: Set<string>; buildings: Set<string>; jobs: Set<string> };
function validatePreset(code: string, payload: unknown, refs: ReferenceSets, add: (issue: ConfigIssue) => void) {
  const data = asRecord(payload);
  const roster = Array.isArray(data.roster) ? data.roster.map(asRecord) : [];
  const instanceIds = new Set(roster.map((hero) => asString(hero.instanceId)).filter(Boolean));
  roster.forEach((hero, index) => {
    checkRef(code, `payload.roster.${index}.definitionId`, asString(hero.definitionId), refs.heroes, "hero_template", add);
    checkRef(code, `payload.roster.${index}.careerId`, asString(hero.careerId), refs.careers, "career", add);
    checkRef(code, `payload.roster.${index}.spiritualRootId`, asString(hero.spiritualRootId), refs.roots, "spiritual_root", add);
    checkRef(code, `payload.roster.${index}.realmId`, asString(hero.realmId), refs.realms, "realm", add);
    (Array.isArray(hero.skillIds) ? hero.skillIds : []).forEach((value, skillIndex) => checkRef(code, `payload.roster.${index}.skillIds.${skillIndex}`, asString(value), refs.skills, "skill", add));
  });
  const camp = asRecord(data.camp);
  checkObjectKeys(code, "payload.camp.buildingLevels", asRecord(camp.buildingLevels), refs.buildings, "building", add);
  checkObjectKeys(code, "payload.camp.workerAssignments", asRecord(camp.workerAssignments), refs.jobs, "production_job", add);
  checkObjectKeys(code, "payload.wallet", asRecord(data.wallet), refs.assets, "game_asset", add);
  checkObjectKeys(code, "payload.inventory", asRecord(data.inventory), refs.assets, "game_asset", add);
  const preparation = asRecord(data.expeditionPreparation);
  checkObjectKeys(code, "payload.expeditionPreparation.loadout", asRecord(preparation.loadout), refs.assets, "game_asset", add);
  const presets = Array.isArray(preparation.partyPresets) ? preparation.partyPresets.map(asRecord) : [];
  presets.forEach((preset, presetIndex) => (Array.isArray(preset.slots) ? preset.slots : []).forEach((slot, slotIndex) => {
    const target = asString(slot);
    if (target && !instanceIds.has(target)) add(issue("error", "progression", "new_player_preset", code, `payload.expeditionPreparation.partyPresets.${presetIndex}.slots.${slotIndex}`, "NEW_PLAYER_REFERENCE_MISSING", `新档队伍引用了不存在的修士实例：${target}`, { referenceType: "hero_instance", target }));
  }));
}

function checkRef(presetCode: string, path: string, target: string, values: Set<string>, referenceType: string, add: (issue: ConfigIssue) => void) {
  if (target && !values.has(target)) add(issue("error", "progression", "new_player_preset", presetCode, path, "NEW_PLAYER_REFERENCE_MISSING", `新档引用不存在：${target}`, { referenceType, target }));
}
function checkObjectKeys(presetCode: string, path: string, object: Record<string, unknown>, values: Set<string>, referenceType: string, add: (issue: ConfigIssue) => void) {
  Object.keys(object).forEach((key) => checkRef(presetCode, `${path}.${key}`, key, values, referenceType, add));
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function asString(value: unknown) { return typeof value === "string" ? value : ""; }
function importModule(entityType: string | null) {
  if (!entityType) return null;
  if (["skill", "enemy", "encounter", "combat_parameter"].includes(entityType)) return "combat";
  if (["career", "spiritual_root", "realm", "hero_template", "new_player_preset"].includes(entityType)) return "progression";
  if (["production_rule", "production_job", "building"].includes(entityType)) return "economy";
  if (entityType.startsWith("map_")) return "maps";
  if (entityType.startsWith("expedition_")) return "expedition";
  return "base";
}
