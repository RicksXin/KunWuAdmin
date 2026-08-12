import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
import { v5 as uuidv5, v7 as uuidv7 } from "uuid";
import { z } from "zod";
import {
  auditLogs,
  buildingLevels,
  buildings,
  careerGrowths,
  careerSkills,
  careers,
  combatParameters,
  configEntityRevisions,
  configEntitySources,
  configImportIssueSources,
  configImportIssues,
  configImportRuns,
  configSets,
  encounterMembers,
  encounters,
  enemies,
  enemySkills,
  expeditionItemRules,
  expeditionRules,
  foodRestRules,
  gameAssets,
  heroTemplateSkills,
  heroTemplates,
  i18nTexts,
  lootPoolEntries,
  lootPools,
  mapDefinitions,
  mapExpeditionRules,
  mapObjectPlacements,
  mapObjectPrototypes,
  newPlayerPresets,
  productionJobs,
  productionRules,
  realms,
  rewardPackEntries,
  rewardPacks,
  skillEffects,
  skills,
  spiritualRoots,
  statusEffects,
  storageLevels,
} from "../db/schema";
import { createToolDatabase } from "./db-runtime";

const IMPORTER_VERSION = "d0-import-v2";
const IMPORT_NAMESPACE = "9f709ca7-b246-4e88-a27b-739944d33947";
const CONFIG_SET_CODE = "demo_d0";
const ATTRIBUTES = ["strength", "magic", "technique", "speed", "constitution", "armor", "resistance"] as const;
type Attribute = typeof ATTRIBUTES[number];
type JsonObject = Record<string, unknown>;

const attributesSchema = z.object(Object.fromEntries(ATTRIBUTES.map((key) => [key, z.number().int()])) as Record<Attribute, z.ZodNumber>);
const careerSchema = z.object({
  id: z.string(), nameKey: z.string(), tier: z.number().int(), primaryAttribute: z.enum(ATTRIBUTES),
  skillIds: z.array(z.string()), baseAttributes: attributesSchema, baseHp: z.number().int().positive(),
}).passthrough();
const skillSchema = z.object({
  id: z.string(), nameKey: z.string(), damageKind: z.string(), targetType: z.string(), ignoreTaunt: z.boolean(),
  baseIntervalTicks: z.number().int().positive(), cooldownTicks: z.number().int().nonnegative(), castTicks: z.number().int().nonnegative().optional(),
  scalingAttribute: z.enum(ATTRIBUTES).optional(), primaryAttribute: z.enum(ATTRIBUTES).optional(), primaryPercent: z.number().int(),
  secondaryAttribute: z.enum(ATTRIBUTES).optional(), secondaryPercent: z.number().int().optional(),
  appliesStatus: z.object({ kind: z.string(), durationTicks: z.number().int().nonnegative(), magnitude: z.number().int() }).optional(),
}).passthrough();
const encounterSchema = z.object({
  id: z.string(), escapeEnemyHpPercent: z.number().int(), soulCrystalReward: z.number().int(),
  enemies: z.array(z.object({
    id: z.string(), nameKey: z.string(), raceKey: z.string(), maxHp: z.number().int().positive(), attributes: attributesSchema,
    skillIds: z.array(z.string()), initialActionTimer: z.number().int().nonnegative(),
  }).passthrough()),
  loot: z.array(z.object({ itemId: z.string(), nameKey: z.string(), amount: z.number().int().positive() })),
}).passthrough();

interface SourceRef { sourcePath: string; sourcePointer?: string }
interface ImportedEntity { entityType: string; entityCode: string; entityId: string; source: SourceRef; snapshot: unknown }
interface ImportIssue {
  severity: "error" | "warning" | "info";
  conflictType: string;
  entityType?: string;
  entityCode?: string;
  candidateValues: unknown;
  sources: SourceRef[];
}

function stableId(configSetId: string, entityType: string, code: string) {
  return uuidv5(`${configSetId}:${entityType}:${code}`, IMPORT_NAMESPACE);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as JsonObject).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest();
}

function withoutComments(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutComments);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonObject).filter(([key]) => !key.startsWith("//")).map(([key, entry]) => [key, withoutComments(entry)]));
  }
  return value;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function auditGodotRuntime(sources: Record<string, string>) {
  const repository = sources["scripts/autoload/config_repository.gd"] ?? "";
  const game = sources["scripts/autoload/game.gd"] ?? "";
  const combat = sources["scripts/scenes/combat.gd"] ?? "";
  const runtimeText = Object.values(sources).join("\n");
  const configEvidence = [
    "func refresh_remote", "const REQUIRED_MODULES", "func _load_cached_release",
    "func _embedded_runtime_tables", "func _sha256_hex", "ConfigRepository.table",
    "func get_expedition_map_rule", "func item_weight", "func expedition_burden_limit",
  ];
  const stableIdEvidence = [
    "func get_map_definition", "func get_party_preset", "func get_encounter", "func get_enemy",
    "func map_object_key", "func begin_encounter", '"encounterId"', '"mapObjectId"',
    "Game.get_encounter()", "Game.get_active_map_object_id()",
  ];
  const economyEvidence = ["func _adapt_economy", 'ling_pu_config.get("jobs"', 'job.get("upkeepPerWorker"'];
  const fixedIdPatterns = [
    { label: "fixed completed object key", pattern: /map_01\.can_jin_shi_kui_01/ },
    { label: "fixed map completion prefix", pattern: /["']map_01\.["']\s*\+/ },
    { label: "first encounter array selection", pattern: /encounters\s*\[\s*0\s*\]/ },
    { label: "first enemy array selection", pattern: /enemies\s*\[\s*0\s*\]/ },
    { label: "first party preset selection", pattern: /partyPresets[^\n]*\[\s*0\s*\]/ },
  ];
  const fixedIdMatches = fixedIdPatterns.filter(({ pattern }) => pattern.test(runtimeText)).map(({ label }) => label);
  return {
    configEvidence,
    stableIdEvidence,
    economyEvidence,
    fixedIdMatches,
    configRepositoryReady: configEvidence.every((needle) => repository.includes(needle) || game.includes(needle)),
    stableIdsReady: stableIdEvidence.every((needle) => game.includes(needle) || combat.includes(needle)) && fixedIdMatches.length === 0,
    economyConfigReady: economyEvidence.every((needle) => repository.includes(needle) || game.includes(needle)),
  };
}

async function main() {
  const sourceRoot = path.resolve(process.env.KUNWU_GODOT_ROOT ?? path.join(process.cwd(), "..", "KunWuGodot"));
  const fileCache = new Map<string, Buffer>();
  const readSource = async (sourcePath: string) => {
    const cached = fileCache.get(sourcePath);
    if (cached) return cached;
    const contents = await readFile(path.join(sourceRoot, sourcePath));
    fileCache.set(sourcePath, contents);
    return contents;
  };
  const readJson = async <T>(sourcePath: string) => JSON.parse((await readSource(sourcePath)).toString("utf8")) as T;

  const careerFiles = (await readdir(path.join(sourceRoot, "data/careers"))).filter((file) => file.endsWith(".json")).sort();
  const skillFiles = (await readdir(path.join(sourceRoot, "data/careers/skills"))).filter((file) => file.endsWith(".json")).sort();
  const sourcePaths = [
    "data/balance/combat_constants.json", "data/balance/growth_rates.json", "data/balance/production_rates.json",
    "data/balance/realm_ranges.json", "data/balance/spiritual_root_multipliers.json",
    ...careerFiles.map((file) => `data/careers/${file}`), ...skillFiles.map((file) => `data/careers/skills/${file}`),
    "data/config/combat_d0.json", "data/config/default_profile.json", "data/config/expedition_preparation.json",
    "data/config/ling_pu_config.json", "data/heroes/starting.json", "data/localization/zh_cn.json",
    "data/maps/map_01_demo.json", "data/maps/map_01_manifest.json", "data/maps/map_02_manifest.json",
    "scripts/autoload/config_repository.gd", "scripts/autoload/game.gd", "scripts/scenes/boot.gd",
    "scripts/scenes/camp.gd", "scripts/scenes/combat.gd", "scripts/scenes/map_canvas.gd", "scripts/scenes/map_scene.gd",
    "Docs/13_数值设计方案.md",
  ];
  await Promise.all(sourcePaths.map(readSource));
  const aggregateHash = sha256(canonicalJson({
    importer: IMPORTER_VERSION,
    files: sourcePaths.map((sourcePath) => ({ sourcePath, sha256: sha256(fileCache.get(sourcePath)!).toString("hex") })),
  }));

  const { pool, db } = createToolDatabase("runtime");
  let importRunId: string | undefined;
  try {
    const [configSet] = await db.select({ id: configSets.id, currentRevision: configSets.currentRevision })
      .from(configSets).where(eq(configSets.code, CONFIG_SET_CODE)).limit(1);
    if (!configSet) throw new Error(`Missing config set: ${CONFIG_SET_CODE}. Run pnpm db:seed first.`);

    const [matchingRun] = await db.select({ id: configImportRuns.id, summary: configImportRuns.summary })
      .from(configImportRuns)
      .where(and(
        eq(configImportRuns.configSetId, configSet.id),
        eq(configImportRuns.sourceKind, "godot_d0"),
        eq(configImportRuns.sourceHash, aggregateHash),
        inArray(configImportRuns.status, ["completed", "completed_with_issues"]),
      )).orderBy(desc(configImportRuns.createdAt)).limit(1);

    importRunId = uuidv7();
    const now = new Date();
    if (matchingRun) {
      const summary = { unchangedFromRunId: matchingRun.id, sourceFiles: sourcePaths.length, previousSummary: matchingRun.summary };
      await db.insert(configImportRuns).values({
        id: importRunId, configSetId: configSet.id, sourceKind: "godot_d0", sourceRoot, sourceHash: aggregateHash,
        status: "skipped", startedAt: now, finishedAt: now, summary,
      });
      console.log("GODOT_CONFIG_IMPORT_UNCHANGED", summary);
      return;
    }

    await db.insert(configImportRuns).values({
      id: importRunId, configSetId: configSet.id, sourceKind: "godot_d0", sourceRoot, sourceHash: aggregateHash,
      status: "running", startedAt: now,
    });

    const localization = withoutComments(await readJson<JsonObject>("data/localization/zh_cn.json")) as Record<string, string>;
    const careersData = await Promise.all(careerFiles.map(async (file) => careerSchema.parse(await readJson(`data/careers/${file}`))));
    const standaloneSkills = await Promise.all(skillFiles.map(async (file) => skillSchema.parse(await readJson(`data/careers/skills/${file}`))));
    const combatData = z.object({
      defenseLevelConstant: z.number().int().positive(), partyInitialActionTimers: z.array(z.number().int().nonnegative()),
      skills: z.array(skillSchema), encounters: z.array(encounterSchema),
    }).parse(await readJson("data/config/combat_d0.json"));
    const combatConstants = z.object({ combat_constants: z.object({
      constitutionHpFactor: z.number().int(), minActionIntervalTicks: z.number().int(), maxActionIntervalTicks: z.number().int(),
      minDamage: z.number().int(), defenseLevelConstant: z.object({ base: z.number().int(), perTenLevels: z.number().int() }),
    }) }).passthrough().parse(await readJson("data/balance/combat_constants.json"));
    const growthRates = withoutComments(await readJson<JsonObject>("data/balance/growth_rates.json")) as Record<string, Record<Attribute, number>>;
    const spiritualRootData = withoutComments(await readJson<JsonObject>("data/balance/spiritual_root_multipliers.json")) as Record<string, { basePercent: number; growthPercent: number }>;
    const realmData = z.object({ realm_ranges: z.object({ maxLevel: z.number().int(), tier1UnlockLevel: z.number().int(), realms: z.array(z.object({ id: z.string(), min: z.number().int(), max: z.number().int() })) }) }).passthrough().parse(await readJson("data/balance/realm_ranges.json"));
    const productionCandidate = withoutComments(await readJson<JsonObject>("data/balance/production_rates.json")) as { production_rates: unknown };
    const lingPuData = z.object({ ling_pu: z.object({
      baseCycleSeconds: z.number().int().positive(), maxOfflineCycles: z.number().int().positive(),
      initialWorkerCount: z.number().int(), workersPerRecruit: z.number().int(), recruitSpiritGrainCost: z.number().int(),
      jobs: z.array(z.object({ id: z.string(), outputPerWorker: z.number().int(), upkeepPerWorker: z.number().int(), shutdownPriority: z.number().int().nullable() })),
      resources: z.record(z.string(), z.object({ initialLevel: z.number().int(), capacities: z.array(z.number().int()), upgradeSpiritWoodCosts: z.array(z.number().int()) })),
    }) }).parse(await readJson("data/config/ling_pu_config.json"));
    const expeditionData = z.object({ expedition_preparation: z.object({
      staminaMax: z.number().int(), staminaRecoveryAmount: z.number().int(), staminaRecoveryIntervalSeconds: z.number().int(),
      baseBurden: z.number().int(), strengthBurdenFactor: z.number().int(), constitutionBurdenFactor: z.number().int(),
      maxPartyPresets: z.number().int(), partyUnlockCosts: z.array(z.number().int()),
      items: z.array(z.object({ id: z.string(), nameKey: z.string(), inventoryId: z.string().nullable(), weight: z.number().int() })),
      field: z.object({
        restUseLimitsByForgeLevel: z.array(z.number().int()), grainDepletionStepLimit: z.number().int(), healingPercent: z.number().int(),
        defaultLootWeight: z.number().int(), foodItems: z.array(z.object({ itemId: z.string(), nameKey: z.string(), weight: z.number().int(), grainRestored: z.number().int() })),
        returnTalismanItemId: z.string(), returnTalismanNameKey: z.string(),
      }),
      maps: z.array(z.object({ mapId: z.string(), mapNumber: z.number().int(), nameKey: z.string(), staminaCost: z.number().int(), grainPerStep: z.number().int(), minimumCarriedGrain: z.number().int(), unlockFlag: z.string().nullable() })),
    }) }).parse(await readJson("data/config/expedition_preparation.json"));
    const defaultProfile = await readJson<JsonObject>("data/config/default_profile.json");
    const startingHeroes = z.array(z.object({ instanceId: z.string(), nameKey: z.string(), careerId: z.string(), spiritualRootId: z.string(), realmId: z.string(), level: z.number().int() }).passthrough()).parse(await readJson("data/heroes/starting.json"));
    const mapData = z.object({
      id: z.string(), name: z.string(), width: z.number().int(), height: z.number().int(), activeWidth: z.number().int(), activeHeight: z.number().int(),
      entryX: z.number().int(), entryY: z.number().int(), terrainRows: z.array(z.string()), objects: z.array(z.record(z.string(), z.unknown())), visual: z.record(z.string(), z.unknown()),
    }).parse(await readJson("data/maps/map_01_demo.json"));
    const map01Manifest = z.object({ mapId: z.string(), schemaVersion: z.number().int(), status: z.string(), scenePath: z.string().nullable(), mapDataPath: z.string().nullable(), tileSetPath: z.string().optional(), artLicense: z.string().optional() }).parse(await readJson("data/maps/map_01_manifest.json"));
    const map02Manifest = z.object({ mapId: z.string(), schemaVersion: z.number().int(), status: z.string(), scenePath: z.string().nullable(), mapDataPath: z.string().nullable() }).parse(await readJson("data/maps/map_02_manifest.json"));
    const runtimeSources = Object.fromEntries(([
      "scripts/autoload/config_repository.gd", "scripts/autoload/game.gd", "scripts/scenes/boot.gd",
      "scripts/scenes/camp.gd", "scripts/scenes/combat.gd", "scripts/scenes/map_canvas.gd", "scripts/scenes/map_scene.gd",
    ] as const).map((sourcePath) => [sourcePath, fileCache.get(sourcePath)!.toString("utf8")]));
    const runtimeAudit = auditGodotRuntime(runtimeSources);

    const entities: ImportedEntity[] = [];
    const issues: ImportIssue[] = [];
    const counts: Record<string, number> = {};
    const nextRevision = Number(configSet.currentRevision) + 1;
    const id = (type: string, code: string) => stableId(configSet.id, type, code);
    const sourceHash = (sourcePath: string) => sha256(fileCache.get(sourcePath)!);
    const entity = (entityType: string, entityCode: string, source: SourceRef, snapshot: unknown) => {
      const entityId = id(entityType, entityCode);
      entities.push({ entityType, entityCode, entityId, source, snapshot });
      counts[entityType] = (counts[entityType] ?? 0) + 1;
      return entityId;
    };

    const assetSpecs = new Map<string, { nameKey: string; assetType: string; weight: number; storageKind: string }>();
    const addAsset = (code: string, nameKey: string, assetType: string, weight = 0, storageKind = "inventory") => assetSpecs.set(code, { nameKey, assetType, weight, storageKind });
    for (const [code] of Object.entries(defaultProfile.wallet as JsonObject)) {
      const snake = code.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      addAsset(code, `resource.${snake}`, ["soulCrystal", "immortalCoin"].includes(code) ? "currency" : "production_resource", code === "spiritGrain" ? 1 : 0, "wallet");
    }
    for (const item of expeditionData.expedition_preparation.items) addAsset(item.inventoryId ?? item.id, item.nameKey, item.id === "spiritGrain" ? "production_resource" : "tool", item.weight, item.inventoryId ? "inventory" : "wallet");
    for (const food of expeditionData.expedition_preparation.field.foodItems) addAsset(food.itemId, food.nameKey, "food", food.weight);
    addAsset(expeditionData.expedition_preparation.field.returnTalismanItemId, expeditionData.expedition_preparation.field.returnTalismanNameKey, "tool", 1);
    for (const encounter of combatData.encounters) for (const loot of encounter.loot) if (!assetSpecs.has(loot.itemId)) addAsset(loot.itemId, loot.nameKey, "material", expeditionData.expedition_preparation.field.defaultLootWeight);
    for (const object of mapData.objects) {
      const reward = object.reward as JsonObject | undefined;
      if (reward?.itemId && !assetSpecs.has(String(reward.itemId))) addAsset(String(reward.itemId), `item.${reward.itemId}`, "tool", 1);
    }

    const runtimeSkills = new Map(combatData.skills.map((skill) => [skill.id, skill]));
    for (const standalone of standaloneSkills) {
      const runtime = runtimeSkills.get(standalone.id);
      if (!runtime) continue;
      issues.push({
        severity: "warning", conflictType: "duplicate_skill_definition", entityType: "skill", entityCode: standalone.id,
        candidateValues: { selected: "combat_d0_runtime", combatD0: runtime, standalone },
        sources: [
          { sourcePath: "data/config/combat_d0.json", sourcePointer: `/skills/${combatData.skills.findIndex((skill) => skill.id === standalone.id)}` },
          { sourcePath: `data/careers/skills/${standalone.id}.json`, sourcePointer: "/" },
        ],
      });
    }
    const selectedSkills = new Map(standaloneSkills.filter((skill) => !runtimeSkills.has(skill.id)).map((skill) => [skill.id, skill]));
    for (const runtime of combatData.skills) selectedSkills.set(runtime.id, runtime);

    issues.push(
      {
        severity: "warning", conflictType: "combat_parameter_conflict", entityType: "combat_parameter", entityCode: "default",
        candidateValues: { selected: { defenseBase: combatData.defenseLevelConstant, defensePerTenLevels: 0, usage: "D0 runtime" }, candidate: combatConstants.combat_constants.defenseLevelConstant },
        sources: [{ sourcePath: "data/config/combat_d0.json", sourcePointer: "/defenseLevelConstant" }, { sourcePath: "data/balance/combat_constants.json", sourcePointer: "/combat_constants/defenseLevelConstant" }],
      },
      {
        severity: "warning", conflictType: "production_candidate_mismatch", entityType: "production_rule", entityCode: "default",
        candidateValues: { selected: lingPuData.ling_pu.jobs, candidate: productionCandidate.production_rates, note: "Runtime reads the selected D0 jobs from ling_pu_config / released economy module." },
        sources: [{ sourcePath: "data/config/ling_pu_config.json", sourcePointer: "/ling_pu/jobs" }, { sourcePath: "data/balance/production_rates.json", sourcePointer: "/production_rates" }],
      },
      {
        severity: "warning", conflictType: "d0_v1_rule_conflict", entityType: "expedition_rule", entityCode: "default",
        candidateValues: { selectedD0HealingPercent: expeditionData.expedition_preparation.field.healingPercent, v1PlannedHealingPercent: 35 },
        sources: [{ sourcePath: "data/config/expedition_preparation.json", sourcePointer: "/expedition_preparation/field/healingPercent" }, { sourcePath: "Docs/13_数值设计方案.md", sourcePointer: "D0 与 1.0 口径" }],
      },
      {
        severity: "warning", conflictType: "d0_v1_rule_conflict", entityType: "expedition_rule", entityCode: "default",
        candidateValues: { selectedD0MaterialLossPercent: 50, v1PlannedMaterialLossPercent: 30, note: "D0 retains floor(50%); 1.0 plans 30% loss" },
        sources: [{ sourcePath: "scripts/autoload/game.gd", sourcePointer: "L429-L443" }, { sourcePath: "Docs/13_数值设计方案.md", sourcePointer: "D0 与 1.0 口径" }],
      },
    );
    if (!runtimeAudit.configRepositoryReady) issues.push({
      severity: "error", conflictType: "runtime_hardcoded_config", entityType: "expedition_rule", entityCode: "default",
      candidateValues: { fields: ["mapId", "partyPresetId", "staminaCost", "minimumCarriedGrain", "baseBurden", "itemWeights", "discoveryRadius"], evidence: runtimeAudit.configEvidence, note: "Changing database values alone cannot affect current Godot runtime." },
      sources: [{ sourcePath: "scripts/autoload/config_repository.gd", sourcePointer: "runtime adapter" }, { sourcePath: "scripts/autoload/game.gd", sourcePointer: "configuration accessors" }],
    });
    if (!runtimeAudit.stableIdsReady) issues.push({
      severity: "error", conflictType: "runtime_fixed_id_assumption", entityType: "map_definition", entityCode: "map_01",
      candidateValues: { forbiddenMatches: runtimeAudit.fixedIdMatches, requiredEvidence: runtimeAudit.stableIdEvidence },
      sources: [{ sourcePath: "scripts/autoload/game.gd", sourcePointer: "stable ID accessors" }, { sourcePath: "scripts/scenes/combat.gd", sourcePointer: "encounter state and completion key" }],
    });

    await db.transaction(async (tx) => {
      if (runtimeAudit.configRepositoryReady && runtimeAudit.stableIdsReady) {
        const priorRuns = await tx.select({ id: configImportRuns.id }).from(configImportRuns)
          .where(eq(configImportRuns.configSetId, configSet.id));
        if (priorRuns.length) {
          await tx.update(configImportIssues).set({
            resolutionStatus: "resolved", resolvedAt: new Date(),
            resolutionNotes: "Godot runtime audit passed: remote/cache/embedded configuration repository and stable map/party/encounter/object IDs are wired into runtime state.",
          }).where(and(
            inArray(configImportIssues.importRunId, priorRuns.map((run) => run.id)),
            inArray(configImportIssues.conflictType, ["runtime_hardcoded_config", "runtime_fixed_id_assumption"]),
            eq(configImportIssues.resolutionStatus, "unresolved"),
          ));
        }
      }
      if (runtimeAudit.economyConfigReady) {
        const priorRuns = await tx.select({ id: configImportRuns.id }).from(configImportRuns)
          .where(eq(configImportRuns.configSetId, configSet.id));
        if (priorRuns.length) {
          await tx.update(configImportIssues).set({
            resolutionStatus: "resolved", resolvedAt: new Date(),
            resolutionNotes: "Godot runtime now reads production cycles, job output, upkeep, and shutdown priority from ling_pu_config / the released economy module.",
          }).where(and(
            inArray(configImportIssues.importRunId, priorRuns.map((run) => run.id)),
            eq(configImportIssues.conflictType, "production_runtime_table_mismatch"),
            eq(configImportIssues.resolutionStatus, "unresolved"),
          ));
        }
      }
      await tx.delete(configEntitySources).where(eq(configEntitySources.configSetId, configSet.id));

      for (const [code, text] of Object.entries(localization)) {
        const entityId = entity("i18n_text", `${code}:zh-CN`, { sourcePath: "data/localization/zh_cn.json", sourcePointer: `/${code}` }, { code, locale: "zh-CN", text });
        await tx.insert(i18nTexts).values({ id: entityId, configSetId: configSet.id, code, locale: "zh-CN", text, revision: nextRevision })
          .onDuplicateKeyUpdate({ set: { text, status: "active", revision: nextRevision } });
      }

      for (const [code, spec] of assetSpecs) {
        const sourcePath = expeditionData.expedition_preparation.items.some((item) => (item.inventoryId ?? item.id) === code) || expeditionData.expedition_preparation.field.foodItems.some((item) => item.itemId === code)
          ? "data/config/expedition_preparation.json" : "data/config/default_profile.json";
        const entityId = entity("game_asset", code, { sourcePath }, spec);
        await tx.insert(gameAssets).values({
          id: entityId, configSetId: configSet.id, code, ...spec, revision: nextRevision,
          isProtected: code === "return_talisman", isDiscardable: code !== "return_talisman", isTradeable: false,
        }).onDuplicateKeyUpdate({ set: { ...spec, revision: nextRevision, status: "active" } });
      }

      const encounterRewardPackIds: Record<string, string> = {};
      const encounterLootPoolIds: Record<string, string> = {};
      for (const encounter of combatData.encounters) {
        const rewardCode = `${encounter.id}.first_clear`;
        const rewardId = entity("reward_pack", rewardCode, { sourcePath: "data/config/combat_d0.json", sourcePointer: `/encounters/${combatData.encounters.indexOf(encounter)}/soulCrystalReward` }, { soulCrystalReward: encounter.soulCrystalReward });
        encounterRewardPackIds[encounter.id] = rewardId;
        await tx.insert(rewardPacks).values({ id: rewardId, configSetId: configSet.id, code: rewardCode, nameKey: `encounter.${encounter.id}.first_clear`, grantMode: "all", revision: nextRevision })
          .onDuplicateKeyUpdate({ set: { revision: nextRevision, status: "active" } });
        await tx.delete(rewardPackEntries).where(eq(rewardPackEntries.rewardPackId, rewardId));
        await tx.insert(rewardPackEntries).values({ id: id("reward_pack_entry", `${rewardCode}:soulCrystal`), rewardPackId: rewardId, assetId: id("game_asset", "soulCrystal"), quantityMin: encounter.soulCrystalReward, quantityMax: encounter.soulCrystalReward });

        const lootCode = `${encounter.id}.loot`;
        const lootId = entity("loot_pool", lootCode, { sourcePath: "data/config/combat_d0.json", sourcePointer: `/encounters/${combatData.encounters.indexOf(encounter)}/loot` }, encounter.loot);
        encounterLootPoolIds[encounter.id] = lootId;
        await tx.insert(lootPools).values({ id: lootId, configSetId: configSet.id, code: lootCode, drawMode: "all", drawCount: encounter.loot.length, revision: nextRevision })
          .onDuplicateKeyUpdate({ set: { drawCount: encounter.loot.length, revision: nextRevision, status: "active" } });
        await tx.delete(lootPoolEntries).where(eq(lootPoolEntries.lootPoolId, lootId));
        for (const [sortOrder, loot] of encounter.loot.entries()) {
          await tx.insert(lootPoolEntries).values({ id: id("loot_pool_entry", `${lootCode}:${sortOrder}`), lootPoolId: lootId, assetId: id("game_asset", loot.itemId), quantityMin: loot.amount, quantityMax: loot.amount, sortOrder });
        }
      }

      for (const [order, career] of careersData.entries()) {
        const entityId = entity("career", career.id, { sourcePath: `data/careers/${career.id}.json`, sourcePointer: "/" }, career);
        const attrs = career.baseAttributes;
        await tx.insert(careers).values({
          id: entityId, configSetId: configSet.id, code: career.id, nameKey: career.nameKey, tier: career.tier, primaryAttribute: career.primaryAttribute,
          baseHp: career.baseHp, baseStrength: attrs.strength, baseMagic: attrs.magic, baseTechnique: attrs.technique, baseSpeed: attrs.speed,
          baseConstitution: attrs.constitution, baseArmor: attrs.armor, baseResistance: attrs.resistance, sortOrder: order, revision: nextRevision,
        }).onDuplicateKeyUpdate({ set: {
          nameKey: career.nameKey, tier: career.tier, primaryAttribute: career.primaryAttribute, baseHp: career.baseHp,
          baseStrength: attrs.strength, baseMagic: attrs.magic, baseTechnique: attrs.technique, baseSpeed: attrs.speed,
          baseConstitution: attrs.constitution, baseArmor: attrs.armor, baseResistance: attrs.resistance, sortOrder: order, revision: nextRevision, status: "active",
        } });
        const growth = growthRates[career.id];
        if (!growth) throw new Error(`Missing growth rates for ${career.id}`);
        await tx.insert(careerGrowths).values({
          id: id("career_growth", career.id), careerId: entityId, strengthPerMille: growth.strength, magicPerMille: growth.magic,
          techniquePerMille: growth.technique, speedPerMille: growth.speed, constitutionPerMille: growth.constitution,
          armorPerMille: growth.armor, resistancePerMille: growth.resistance,
        }).onDuplicateKeyUpdate({ set: {
          strengthPerMille: growth.strength, magicPerMille: growth.magic, techniquePerMille: growth.technique, speedPerMille: growth.speed,
          constitutionPerMille: growth.constitution, armorPerMille: growth.armor, resistancePerMille: growth.resistance,
        } });
      }

      for (const [rarityOrder, [code, root]] of Object.entries(spiritualRootData).entries()) {
        const entityId = entity("spiritual_root", code, { sourcePath: "data/balance/spiritual_root_multipliers.json", sourcePointer: `/${code}` }, root);
        await tx.insert(spiritualRoots).values({ id: entityId, configSetId: configSet.id, code, nameKey: `spiritual_root.${code}`, basePercent: root.basePercent, growthPercent: root.growthPercent, rarityOrder, sortOrder: rarityOrder, revision: nextRevision })
          .onDuplicateKeyUpdate({ set: { basePercent: root.basePercent, growthPercent: root.growthPercent, rarityOrder, sortOrder: rarityOrder, revision: nextRevision, status: "active" } });
      }

      for (const [orderIndex, realm] of realmData.realm_ranges.realms.entries()) {
        const entityId = entity("realm", realm.id, { sourcePath: "data/balance/realm_ranges.json", sourcePointer: `/realm_ranges/realms/${orderIndex}` }, realm);
        await tx.insert(realms).values({ id: entityId, configSetId: configSet.id, code: realm.id, nameKey: `realm.${realm.id}`, orderIndex, minLevel: realm.min, maxLevel: realm.max, breakthroughLevel: realm.max, sortOrder: orderIndex, revision: nextRevision })
          .onDuplicateKeyUpdate({ set: { orderIndex, minLevel: realm.min, maxLevel: realm.max, breakthroughLevel: realm.max, sortOrder: orderIndex, revision: nextRevision, status: "active" } });
      }

      const statusKinds = new Map<string, { durationTicks: number; magnitude: number }>();
      for (const [sortOrder, skill] of [...selectedSkills.values()].entries()) {
        const runtimeIndex = combatData.skills.findIndex((candidate) => candidate.id === skill.id);
        const sourcePath = runtimeIndex >= 0 ? "data/config/combat_d0.json" : `data/careers/skills/${skill.id}.json`;
        const pointer = runtimeIndex >= 0 ? `/skills/${runtimeIndex}` : "/";
        const entityId = entity("skill", skill.id, { sourcePath, sourcePointer: pointer }, skill);
        const primaryAttribute = skill.primaryAttribute ?? skill.scalingAttribute ?? null;
        await tx.insert(skills).values({
          id: entityId, configSetId: configSet.id, code: skill.id, nameKey: skill.nameKey, damageKind: skill.damageKind, targetType: skill.targetType,
          ignoreTaunt: skill.ignoreTaunt, baseIntervalTicks: skill.baseIntervalTicks, castTicks: skill.castTicks ?? 0, cooldownTicks: skill.cooldownTicks,
          primaryAttribute, primaryPercent: skill.primaryPercent, secondaryAttribute: skill.secondaryAttribute ?? null,
          secondaryPercent: skill.secondaryPercent ?? 0, sortOrder, revision: nextRevision,
        }).onDuplicateKeyUpdate({ set: {
          nameKey: skill.nameKey, damageKind: skill.damageKind, targetType: skill.targetType, ignoreTaunt: skill.ignoreTaunt,
          baseIntervalTicks: skill.baseIntervalTicks, castTicks: skill.castTicks ?? 0, cooldownTicks: skill.cooldownTicks,
          primaryAttribute, primaryPercent: skill.primaryPercent, secondaryAttribute: skill.secondaryAttribute ?? null,
          secondaryPercent: skill.secondaryPercent ?? 0, sortOrder, revision: nextRevision, status: "active",
        } });
        await tx.delete(skillEffects).where(eq(skillEffects.skillId, entityId));
        if (skill.appliesStatus) {
          statusKinds.set(skill.appliesStatus.kind, { durationTicks: skill.appliesStatus.durationTicks, magnitude: skill.appliesStatus.magnitude });
          await tx.insert(skillEffects).values({
            id: id("skill_effect", `${skill.id}:0`), skillId: entityId, orderIndex: 0, effectType: skill.appliesStatus.kind === "purify" ? "purify" : "status",
            durationTicks: skill.appliesStatus.durationTicks, magnitudeInt: skill.appliesStatus.magnitude, parameterJson: { statusCode: skill.appliesStatus.kind },
          });
        }
      }
      for (const [sortOrder, [code, defaults]] of [...statusKinds.entries()].entries()) {
        const entityId = entity("status_effect", code, { sourcePath: "data/config/combat_d0.json", sourcePointer: "/skills/*/appliesStatus" }, defaults);
        await tx.insert(statusEffects).values({ id: entityId, configSetId: configSet.id, code, category: code === "stun" || code === "entangle" ? "control" : "modifier", defaultDurationTicks: defaults.durationTicks, dispellable: code !== "shield", sortOrder, revision: nextRevision })
          .onDuplicateKeyUpdate({ set: { defaultDurationTicks: defaults.durationTicks, sortOrder, revision: nextRevision, status: "active" } });
      }

      const combatParameterId = entity("combat_parameter", "default", { sourcePath: "data/config/combat_d0.json", sourcePointer: "/" }, combatData);
      await tx.insert(combatParameters).values({
        id: combatParameterId, configSetId: configSet.id, code: "default", tickRate: 20,
        constitutionHpFactor: combatConstants.combat_constants.constitutionHpFactor,
        minActionIntervalTicks: combatConstants.combat_constants.minActionIntervalTicks,
        maxActionIntervalTicks: combatConstants.combat_constants.maxActionIntervalTicks,
        minDamage: combatConstants.combat_constants.minDamage, defenseBase: combatData.defenseLevelConstant, defensePerTenLevels: 0,
        partyInitialActionTimers: combatData.partyInitialActionTimers,
      }).onDuplicateKeyUpdate({ set: {
        constitutionHpFactor: combatConstants.combat_constants.constitutionHpFactor,
        minActionIntervalTicks: combatConstants.combat_constants.minActionIntervalTicks,
        maxActionIntervalTicks: combatConstants.combat_constants.maxActionIntervalTicks,
        minDamage: combatConstants.combat_constants.minDamage, defenseBase: combatData.defenseLevelConstant, defensePerTenLevels: 0,
        partyInitialActionTimers: combatData.partyInitialActionTimers,
      } });

      for (const career of careersData) {
        const careerId = id("career", career.id);
        await tx.delete(careerSkills).where(eq(careerSkills.careerId, careerId));
        for (const [slotIndex, skillCode] of career.skillIds.entries()) {
          await tx.insert(careerSkills).values({ id: id("career_skill", `${career.id}:${slotIndex}`), careerId, skillId: id("skill", skillCode), slotIndex });
        }
      }

      const roster = (defaultProfile.roster as JsonObject[]) ?? [];
      for (const [sortOrder, starting] of startingHeroes.entries()) {
        const runtimeHero = roster.find((hero) => hero.instanceId === starting.instanceId);
        if (!runtimeHero) throw new Error(`Missing default profile hero: ${starting.instanceId}`);
        const attrs = runtimeHero.attributes as Record<Attribute, number>;
        const entityId = entity("hero_template", starting.instanceId, { sourcePath: "data/heroes/starting.json", sourcePointer: `/${sortOrder}` }, { starting, runtimeHero });
        await tx.insert(heroTemplates).values({
          id: entityId, configSetId: configSet.id, code: starting.instanceId, nameKey: starting.nameKey,
          careerId: id("career", starting.careerId), spiritualRootId: id("spiritual_root", starting.spiritualRootId), initialRealmId: id("realm", starting.realmId),
          initialLevel: starting.level, strengthOverride: attrs.strength, magicOverride: attrs.magic, techniqueOverride: attrs.technique,
          speedOverride: attrs.speed, constitutionOverride: attrs.constitution, armorOverride: attrs.armor, resistanceOverride: attrs.resistance,
          maxHpOverride: Number(runtimeHero.maxHp), sortOrder, revision: nextRevision,
        }).onDuplicateKeyUpdate({ set: {
          nameKey: starting.nameKey, careerId: id("career", starting.careerId), spiritualRootId: id("spiritual_root", starting.spiritualRootId), initialRealmId: id("realm", starting.realmId),
          initialLevel: starting.level, strengthOverride: attrs.strength, magicOverride: attrs.magic, techniqueOverride: attrs.technique,
          speedOverride: attrs.speed, constitutionOverride: attrs.constitution, armorOverride: attrs.armor, resistanceOverride: attrs.resistance,
          maxHpOverride: Number(runtimeHero.maxHp), sortOrder, revision: nextRevision, status: "active",
        } });
        await tx.delete(heroTemplateSkills).where(eq(heroTemplateSkills.heroTemplateId, entityId));
        for (const [slotIndex, skillCode] of (runtimeHero.skillIds as string[]).entries()) {
          await tx.insert(heroTemplateSkills).values({ id: id("hero_template_skill", `${starting.instanceId}:${slotIndex}`), heroTemplateId: entityId, skillId: id("skill", skillCode), slotIndex });
        }
      }

      const presetId = entity("new_player_preset", "d0_default", { sourcePath: "data/config/default_profile.json", sourcePointer: "/" }, defaultProfile);
      await tx.insert(newPlayerPresets).values({ id: presetId, configSetId: configSet.id, code: "d0_default", name: "D0 默认新档", isDefault: true, payload: defaultProfile, revision: nextRevision })
        .onDuplicateKeyUpdate({ set: { name: "D0 默认新档", isDefault: true, payload: defaultProfile, revision: nextRevision, status: "active" } });

      for (const encounter of combatData.encounters) {
        for (const [enemyIndex, enemy] of encounter.enemies.entries()) {
          const attrs = enemy.attributes;
          const entityId = entity("enemy", enemy.id, { sourcePath: "data/config/combat_d0.json", sourcePointer: `/encounters/${combatData.encounters.indexOf(encounter)}/enemies/${enemyIndex}` }, enemy);
          await tx.insert(enemies).values({
            id: entityId, configSetId: configSet.id, code: enemy.id, nameKey: enemy.nameKey, raceKey: enemy.raceKey, maxHp: enemy.maxHp,
            strength: attrs.strength, magic: attrs.magic, technique: attrs.technique, speed: attrs.speed, constitution: attrs.constitution,
            armor: attrs.armor, resistance: attrs.resistance, sortOrder: enemyIndex, revision: nextRevision,
          }).onDuplicateKeyUpdate({ set: {
            nameKey: enemy.nameKey, raceKey: enemy.raceKey, maxHp: enemy.maxHp, strength: attrs.strength, magic: attrs.magic,
            technique: attrs.technique, speed: attrs.speed, constitution: attrs.constitution, armor: attrs.armor, resistance: attrs.resistance,
            revision: nextRevision, status: "active",
          } });
          await tx.delete(enemySkills).where(eq(enemySkills.enemyId, entityId));
          for (const [slotIndex, skillCode] of enemy.skillIds.entries()) {
            await tx.insert(enemySkills).values({ id: id("enemy_skill", `${enemy.id}:${slotIndex}`), enemyId: entityId, skillId: id("skill", skillCode), slotIndex });
          }
        }
        const encounterId = entity("encounter", encounter.id, { sourcePath: "data/config/combat_d0.json", sourcePointer: `/encounters/${combatData.encounters.indexOf(encounter)}` }, encounter);
        await tx.insert(encounters).values({
          id: encounterId, configSetId: configSet.id, code: encounter.id, encounterType: "normal", escapeEnemyHpPercent: encounter.escapeEnemyHpPercent,
          firstClearRewardPackId: encounterRewardPackIds[encounter.id], lootPoolId: encounterLootPoolIds[encounter.id], revision: nextRevision,
        }).onDuplicateKeyUpdate({ set: {
          escapeEnemyHpPercent: encounter.escapeEnemyHpPercent, firstClearRewardPackId: encounterRewardPackIds[encounter.id],
          lootPoolId: encounterLootPoolIds[encounter.id], revision: nextRevision, status: "active",
        } });
        await tx.delete(encounterMembers).where(eq(encounterMembers.encounterId, encounterId));
        for (const [memberIndex, enemy] of encounter.enemies.entries()) {
          await tx.insert(encounterMembers).values({ id: id("encounter_member", `${encounter.id}:${memberIndex}`), encounterId, enemyId: id("enemy", enemy.id), memberIndex, initialActionTimer: enemy.initialActionTimer });
        }
      }

      const buildingLevelsByCode = (defaultProfile.camp as JsonObject).buildingLevels as Record<string, number>;
      for (const [sortOrder, [code, initialLevel]] of Object.entries(buildingLevelsByCode).entries()) {
        const entityId = entity("building", code, { sourcePath: "data/config/default_profile.json", sourcePointer: `/camp/buildingLevels/${code}` }, { initialLevel });
        await tx.insert(buildings).values({ id: entityId, configSetId: configSet.id, code, nameKey: `building.${code}`, maxLevel: Math.max(1, initialLevel), initialLevel, sortOrder, revision: nextRevision })
          .onDuplicateKeyUpdate({ set: { initialLevel, maxLevel: Math.max(1, initialLevel), sortOrder, revision: nextRevision, status: "active" } });
        await tx.insert(buildingLevels).values({ id: id("building_level", `${code}:${Math.max(1, initialLevel)}`), buildingId: entityId, level: Math.max(1, initialLevel) })
          .onDuplicateKeyUpdate({ set: { level: Math.max(1, initialLevel) } });
      }

      const productionId = entity("production_rule", "default", { sourcePath: "data/config/ling_pu_config.json", sourcePointer: "/ling_pu" }, { cycleSeconds: lingPuData.ling_pu.baseCycleSeconds, maxOfflineCycles: lingPuData.ling_pu.maxOfflineCycles });
      await tx.insert(productionRules).values({
        id: productionId, configSetId: configSet.id, code: "default", baseCycleSeconds: lingPuData.ling_pu.baseCycleSeconds, maxOfflineCycles: lingPuData.ling_pu.maxOfflineCycles,
        initialWorkerCount: lingPuData.ling_pu.initialWorkerCount, workersPerRecruit: lingPuData.ling_pu.workersPerRecruit,
        recruitCostAssetId: id("game_asset", "spiritGrain"), recruitCostAmount: lingPuData.ling_pu.recruitSpiritGrainCost,
      }).onDuplicateKeyUpdate({ set: {
        baseCycleSeconds: lingPuData.ling_pu.baseCycleSeconds, maxOfflineCycles: lingPuData.ling_pu.maxOfflineCycles, initialWorkerCount: lingPuData.ling_pu.initialWorkerCount,
        workersPerRecruit: lingPuData.ling_pu.workersPerRecruit, recruitCostAmount: lingPuData.ling_pu.recruitSpiritGrainCost,
      } });
      for (const [sortOrder, job] of lingPuData.ling_pu.jobs.entries()) {
        const code = job.id;
        const upkeep = job.upkeepPerWorker;
        const entityId = entity("production_job", code, { sourcePath: "data/config/ling_pu_config.json", sourcePointer: `/ling_pu/jobs/${sortOrder}` }, job);
        await tx.insert(productionJobs).values({
          id: entityId, configSetId: configSet.id, code, outputAssetId: id("game_asset", code), outputPerWorker: job.outputPerWorker,
          upkeepAssetId: upkeep ? id("game_asset", "spiritGrain") : null, upkeepPerWorker: upkeep,
          shutdownPriority: job.shutdownPriority, sortOrder, revision: nextRevision,
        }).onDuplicateKeyUpdate({ set: {
          outputPerWorker: job.outputPerWorker, upkeepAssetId: upkeep ? id("game_asset", "spiritGrain") : null, upkeepPerWorker: upkeep,
          shutdownPriority: job.shutdownPriority, sortOrder, revision: nextRevision, status: "active",
        } });
      }
      for (const [assetCode, storage] of Object.entries(lingPuData.ling_pu.resources)) {
        for (const [levelIndex, capacity] of storage.capacities.entries()) {
          await tx.insert(storageLevels).values({
            id: id("storage_level", `${assetCode}:${levelIndex + 1}`), configSetId: configSet.id, assetId: id("game_asset", assetCode),
            level: levelIndex + 1, capacity, upgradeCostAssetId: levelIndex < storage.upgradeSpiritWoodCosts.length ? id("game_asset", "spiritWood") : null,
            upgradeCostAmount: storage.upgradeSpiritWoodCosts[levelIndex] ?? 0,
          }).onDuplicateKeyUpdate({ set: { capacity, upgradeCostAmount: storage.upgradeSpiritWoodCosts[levelIndex] ?? 0 } });
        }
      }

      const expedition = expeditionData.expedition_preparation;
      const expeditionId = entity("expedition_rule", "default", { sourcePath: "data/config/expedition_preparation.json", sourcePointer: "/expedition_preparation" }, expedition);
      await tx.insert(expeditionRules).values({
        id: expeditionId, configSetId: configSet.id, code: "default", staminaMax: expedition.staminaMax,
        staminaRecoveryAmount: expedition.staminaRecoveryAmount, staminaRecoveryIntervalSeconds: expedition.staminaRecoveryIntervalSeconds,
        baseBurden: expedition.baseBurden, strengthBurdenFactor: expedition.strengthBurdenFactor, constitutionBurdenFactor: expedition.constitutionBurdenFactor,
        maxPartyPresets: expedition.maxPartyPresets, partyUnlockCosts: expedition.partyUnlockCosts, baseRestCount: expedition.field.restUseLimitsByForgeLevel[0] ?? 1,
        fieldHealingPercent: expedition.field.healingPercent, grainDepletionStepLimit: expedition.field.grainDepletionStepLimit,
        defaultLootWeight: expedition.field.defaultLootWeight, materialLossBasisPoints: 5000, equipmentLossBasisPoints: 5000,
        returnTalismanAssetId: id("game_asset", expedition.field.returnTalismanItemId),
      }).onDuplicateKeyUpdate({ set: {
        staminaMax: expedition.staminaMax, staminaRecoveryAmount: expedition.staminaRecoveryAmount,
        staminaRecoveryIntervalSeconds: expedition.staminaRecoveryIntervalSeconds, baseBurden: expedition.baseBurden,
        strengthBurdenFactor: expedition.strengthBurdenFactor, constitutionBurdenFactor: expedition.constitutionBurdenFactor,
        maxPartyPresets: expedition.maxPartyPresets, partyUnlockCosts: expedition.partyUnlockCosts,
        fieldHealingPercent: expedition.field.healingPercent, grainDepletionStepLimit: expedition.field.grainDepletionStepLimit,
        defaultLootWeight: expedition.field.defaultLootWeight, materialLossBasisPoints: 5000, equipmentLossBasisPoints: 5000,
      } });
      for (const [sortOrder, item] of expedition.items.entries()) {
        const assetCode = item.inventoryId ?? item.id;
        await tx.insert(expeditionItemRules).values({ id: id("expedition_item_rule", assetCode), configSetId: configSet.id, assetId: id("game_asset", assetCode), consumeTiming: item.id === "spiritGrain" ? "per_step" : "manual", sortOrder })
          .onDuplicateKeyUpdate({ set: { consumeTiming: item.id === "spiritGrain" ? "per_step" : "manual", sortOrder } });
      }
      for (const [sortOrder, food] of expedition.field.foodItems.entries()) {
        await tx.insert(foodRestRules).values({ id: id("food_rest_rule", food.itemId), configSetId: configSet.id, assetId: id("game_asset", food.itemId), grainRestored: food.grainRestored, sortOrder })
          .onDuplicateKeyUpdate({ set: { grainRestored: food.grainRestored, sortOrder } });
      }

      const manifestByMap = new Map([[map01Manifest.mapId, map01Manifest], [map02Manifest.mapId, map02Manifest]]);
      for (const mapRule of expedition.maps) {
        const manifest = manifestByMap.get(mapRule.mapId);
        const isDataMap = mapRule.mapId === mapData.id;
        const entityId = entity("map_definition", mapRule.mapId, { sourcePath: manifest ? `data/maps/${mapRule.mapId}_manifest.json` : "data/config/expedition_preparation.json", sourcePointer: manifest ? "/" : `/expedition_preparation/maps/${expedition.maps.indexOf(mapRule)}` }, { mapRule, manifest, data: isDataMap ? mapData : null });
        const status = isDataMap ? "active" : "disabled";
        await tx.insert(mapDefinitions).values({
          id: entityId, configSetId: configSet.id, code: mapRule.mapId, nameKey: mapRule.nameKey, displayName: isDataMap ? mapData.name : null,
          mapNumber: mapRule.mapNumber, status, schemaVersion: manifest?.schemaVersion ?? 1, scenePath: manifest?.scenePath ?? null,
          artLicense: mapRule.mapId === map01Manifest.mapId ? map01Manifest.artLicense ?? null : null,
          width: isDataMap ? mapData.width : null, height: isDataMap ? mapData.height : null, activeWidth: isDataMap ? mapData.activeWidth : null,
          activeHeight: isDataMap ? mapData.activeHeight : null, entryX: isDataMap ? mapData.entryX : null, entryY: isDataMap ? mapData.entryY : null,
          terrainDocument: isDataMap ? { rows: mapData.terrainRows } : null, visualConfig: isDataMap ? mapData.visual : null,
          unlockCondition: mapRule.unlockFlag ? { flag: mapRule.unlockFlag } : null, sortOrder: mapRule.mapNumber, revision: nextRevision,
        }).onDuplicateKeyUpdate({ set: {
          nameKey: mapRule.nameKey, displayName: isDataMap ? mapData.name : null, status, schemaVersion: manifest?.schemaVersion ?? 1,
          scenePath: manifest?.scenePath ?? null, width: isDataMap ? mapData.width : null, height: isDataMap ? mapData.height : null,
          activeWidth: isDataMap ? mapData.activeWidth : null, activeHeight: isDataMap ? mapData.activeHeight : null,
          entryX: isDataMap ? mapData.entryX : null, entryY: isDataMap ? mapData.entryY : null,
          terrainDocument: isDataMap ? { rows: mapData.terrainRows } : null, visualConfig: isDataMap ? mapData.visual : null,
          unlockCondition: mapRule.unlockFlag ? { flag: mapRule.unlockFlag } : null, revision: nextRevision,
        } });
        await tx.insert(mapExpeditionRules).values({ id: id("map_expedition_rule", mapRule.mapId), mapId: entityId, staminaCost: mapRule.staminaCost, grainPerStep: mapRule.grainPerStep, minimumCarriedGrain: mapRule.minimumCarriedGrain })
          .onDuplicateKeyUpdate({ set: { staminaCost: mapRule.staminaCost, grainPerStep: mapRule.grainPerStep, minimumCarriedGrain: mapRule.minimumCarriedGrain } });
      }

      for (const [sortOrder, object] of mapData.objects.entries()) {
        const instanceCode = String(object.id);
        const prototypeCode = `map_01.${instanceCode}`;
        let rewardPackId: string | null = null;
        const reward = object.reward as JsonObject | undefined;
        if (reward?.itemId) {
          const rewardCode = `${prototypeCode}.reward`;
          rewardPackId = entity("reward_pack", rewardCode, { sourcePath: "data/maps/map_01_demo.json", sourcePointer: `/objects/${sortOrder}/reward` }, reward);
          await tx.insert(rewardPacks).values({ id: rewardPackId, configSetId: configSet.id, code: rewardCode, grantMode: "all", revision: nextRevision })
            .onDuplicateKeyUpdate({ set: { revision: nextRevision, status: "active" } });
          await tx.delete(rewardPackEntries).where(eq(rewardPackEntries.rewardPackId, rewardPackId));
          await tx.insert(rewardPackEntries).values({ id: id("reward_pack_entry", `${rewardCode}:0`), rewardPackId, assetId: id("game_asset", String(reward.itemId)), quantityMin: Number(reward.amount ?? 1), quantityMax: Number(reward.amount ?? 1) });
        }
        const prototypeId = entity("map_object_prototype", prototypeCode, { sourcePath: "data/maps/map_01_demo.json", sourcePointer: `/objects/${sortOrder}` }, object);
        const interactionConfig = Object.fromEntries(Object.entries(object).filter(([key]) => !["id", "kind", "x", "y", "title", "description", "enemyId", "reward"].includes(key)));
        await tx.insert(mapObjectPrototypes).values({
          id: prototypeId, configSetId: configSet.id, code: prototypeCode, kind: String(object.kind), title: String(object.title ?? ""),
          description: String(object.description ?? ""), encounterId: object.enemyId ? id("encounter", String(object.enemyId)) : null,
          rewardPackId, refreshType: object.kind === "enemy_group" ? "per_expedition" : "permanent", interactionConfig, sortOrder, revision: nextRevision,
        }).onDuplicateKeyUpdate({ set: {
          kind: String(object.kind), title: String(object.title ?? ""), description: String(object.description ?? ""),
          encounterId: object.enemyId ? id("encounter", String(object.enemyId)) : null, rewardPackId,
          refreshType: object.kind === "enemy_group" ? "per_expedition" : "permanent", interactionConfig, sortOrder, revision: nextRevision, status: "active",
        } });
        await tx.insert(mapObjectPlacements).values({ id: id("map_object_placement", `map_01:${instanceCode}`), mapId: id("map_definition", "map_01"), instanceCode, prototypeId, x: Number(object.x), y: Number(object.y) })
          .onDuplicateKeyUpdate({ set: { prototypeId, x: Number(object.x), y: Number(object.y) } });
      }

      for (const imported of entities) {
        await tx.insert(configEntitySources).values({
          id: id("config_entity_source", `${imported.entityType}:${imported.entityCode}:${imported.source.sourcePath}`),
          configSetId: configSet.id, entityType: imported.entityType, entityId: imported.entityId, sourceKind: "godot_d0",
          sourcePath: imported.source.sourcePath, sourcePointer: imported.source.sourcePointer,
          sourceHash: sourceHash(imported.source.sourcePath),
        });
        await tx.insert(configEntityRevisions).values({
          id: id("config_entity_revision", `${imported.entityType}:${imported.entityCode}:${nextRevision}`), configSetId: configSet.id,
          entityType: imported.entityType, entityId: imported.entityId, entityCode: imported.entityCode,
          revision: nextRevision, operation: Number(configSet.currentRevision) === 0 ? "import_create" : "import_update", afterData: imported.snapshot,
        });
      }

      for (const [issueIndex, issue] of issues.entries()) {
        const issueId = uuidv7();
        await tx.insert(configImportIssues).values({
          id: issueId, importRunId: importRunId!, severity: issue.severity, conflictType: issue.conflictType,
          entityType: issue.entityType, entityCode: issue.entityCode, candidateValues: issue.candidateValues,
        });
        for (const [sourceIndex, source] of issue.sources.entries()) {
          await tx.insert(configImportIssueSources).values({
            id: id("config_import_issue_source", `${importRunId}:${issueIndex}:${sourceIndex}`), importIssueId: issueId,
            sourcePath: source.sourcePath, sourcePointer: source.sourcePointer, sourceHash: sourceHash(source.sourcePath),
          });
        }
      }

      await tx.update(configSets).set({ currentRevision: nextRevision }).where(eq(configSets.id, configSet.id));
      const summary = {
        configSet: CONFIG_SET_CODE, sourceFiles: sourcePaths.length, sourceHash: aggregateHash.toString("hex"), revision: nextRevision,
        entities: entities.length, counts, issues: {
          total: issues.length, errors: issues.filter((issue) => issue.severity === "error").length,
          warnings: issues.filter((issue) => issue.severity === "warning").length,
        },
      };
      await tx.update(configImportRuns).set({ status: issues.length ? "completed_with_issues" : "completed", finishedAt: new Date(), summary })
        .where(eq(configImportRuns.id, importRunId!));
      await tx.insert(auditLogs).values({ action: "config.import.godot_d0", entityType: "config_set", entityId: configSet.id, configSetId: configSet.id, details: summary });
      console.log("GODOT_CONFIG_IMPORT_OK", summary);
    });
  } catch (error) {
    if (importRunId) {
      await db.update(configImportRuns).set({ status: "failed", finishedAt: new Date(), summary: { error: errorMessage(error) } })
        .where(eq(configImportRuns.id, importRunId)).catch(() => undefined);
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
