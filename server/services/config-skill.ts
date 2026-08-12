import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  configEntityRevisions,
  configChangeRequests,
  configSets,
  skills,
} from "@/db/schema";
import { database } from "@/server/db/client";
import { ConfigSetNotFoundError } from "./config-query";

const attributes = ["strength", "magic", "technique", "speed", "constitution", "armor", "resistance"] as const;
const targets = ["SELF", "ALLY_ALL", "ALLY_LOWEST_HP", "ENEMY_SINGLE", "ENEMY_ALL", "ENEMY_LOWEST_HP", "ENEMY_RANDOM_MULTI"] as const;

export const skillUpdateSchema = z.object({
  revision: z.number().int().positive(),
  nameKey: z.string().trim().min(1).max(160),
  damageKind: z.enum(["physical", "magical", "none"]),
  targetType: z.enum(targets),
  ignoreTaunt: z.boolean(),
  baseIntervalTicks: z.number().int().min(1).max(864000),
  castTicks: z.number().int().min(0).max(864000),
  cooldownTicks: z.number().int().min(0).max(864000),
  primaryAttribute: z.enum(attributes).nullable(),
  primaryPercent: z.number().int().min(0).max(10000),
  secondaryAttribute: z.enum(attributes).nullable(),
  secondaryPercent: z.number().int().min(0).max(10000),
  status: z.enum(["active", "disabled"]),
  sortOrder: z.number().int().min(-100000).max(100000),
  notes: z.string().max(5000).nullable(),
}).superRefine((value, context) => {
  if (value.damageKind !== "none" && (!value.primaryAttribute || value.primaryPercent <= 0)) {
    context.addIssue({ code: "custom", path: ["primaryPercent"], message: "伤害技能必须配置主属性和正倍率" });
  }
  if (!value.secondaryAttribute && value.secondaryPercent !== 0) {
    context.addIssue({ code: "custom", path: ["secondaryPercent"], message: "未选择副属性时倍率必须为 0" });
  }
  if (value.secondaryAttribute && value.secondaryPercent <= 0) {
    context.addIssue({ code: "custom", path: ["secondaryPercent"], message: "选择副属性后倍率必须大于 0" });
  }
});

export type SkillUpdate = z.infer<typeof skillUpdateSchema>;

export class SkillNotFoundError extends Error {}
export class RevisionConflictError extends Error {}

const skillSelection = {
  id: skills.id,
  configSetId: skills.configSetId,
  code: skills.code,
  nameKey: skills.nameKey,
  damageKind: skills.damageKind,
  targetType: skills.targetType,
  ignoreTaunt: skills.ignoreTaunt,
  baseIntervalTicks: skills.baseIntervalTicks,
  castTicks: skills.castTicks,
  cooldownTicks: skills.cooldownTicks,
  primaryAttribute: skills.primaryAttribute,
  primaryPercent: skills.primaryPercent,
  secondaryAttribute: skills.secondaryAttribute,
  secondaryPercent: skills.secondaryPercent,
  status: skills.status,
  sortOrder: skills.sortOrder,
  notes: skills.notes,
  revision: skills.revision,
  updatedAt: skills.updatedAt,
};

export async function getSkill(configSetCode: string, skillCode: string) {
  const [configSet] = await database.select({ id: configSets.id, code: configSets.code })
    .from(configSets).where(eq(configSets.code, configSetCode)).limit(1);
  if (!configSet) throw new ConfigSetNotFoundError(`Config set ${configSetCode} was not found`);

  const [skill] = await database.select(skillSelection).from(skills)
    .where(and(eq(skills.configSetId, configSet.id), eq(skills.code, skillCode))).limit(1);
  if (!skill) throw new SkillNotFoundError(`Skill ${skillCode} was not found`);
  return { configSet: configSet.code, skill: editableSkill(skill) };
}

export async function updateSkill(configSetCode: string, skillCode: string, input: SkillUpdate, requestId: string) {
  const [targetSet] = await database.select({ id: configSets.id }).from(configSets)
    .where(eq(configSets.code, configSetCode)).limit(1);
  if (!targetSet) throw new ConfigSetNotFoundError(`Config set ${configSetCode} was not found`);

  return database.transaction(async (tx) => {
    const [lockedSet] = await tx.select({
      id: configSets.id,
      code: configSets.code,
      currentRevision: configSets.currentRevision,
    }).from(configSets).where(eq(configSets.id, targetSet.id)).limit(1).for("update");
    if (!lockedSet) throw new ConfigSetNotFoundError(`Config set ${configSetCode} was not found`);

    const [before] = await tx.select(skillSelection).from(skills)
      .where(and(eq(skills.configSetId, lockedSet.id), eq(skills.code, skillCode))).limit(1);
    if (!before) throw new SkillNotFoundError(`Skill ${skillCode} was not found`);
    if (before.revision !== input.revision) throw new RevisionConflictError("Skill revision has changed");

    const changes = { ...input };
    delete (changes as Partial<SkillUpdate>).revision;
    const updateResult = await tx.update(skills).set({
      ...changes,
      revision: sql`${skills.revision} + 1`,
    }).where(and(
      eq(skills.id, before.id),
      eq(skills.configSetId, lockedSet.id),
      eq(skills.revision, input.revision),
    ));
    if (updateResult[0].affectedRows !== 1) throw new RevisionConflictError("Skill revision has changed");

    await tx.update(configSets).set({
      currentRevision: sql`${configSets.currentRevision} + 1`,
    }).where(eq(configSets.id, lockedSet.id));
    await tx.update(configChangeRequests).set({ status: "superseded" }).where(and(
      eq(configChangeRequests.configSetId, lockedSet.id),
      inArray(configChangeRequests.status, ["draft", "submitted", "approved"]),
    ));

    const [after] = await tx.select(skillSelection).from(skills).where(eq(skills.id, before.id)).limit(1);
    if (!after) throw new SkillNotFoundError(`Skill ${skillCode} disappeared during update`);

    const beforeSnapshot = snapshot(before);
    const afterSnapshot = snapshot(after);
    await tx.insert(configEntityRevisions).values({
      configSetId: lockedSet.id,
      entityType: "skill",
      entityId: before.id,
      entityCode: before.code,
      revision: after.revision,
      operation: "update",
      beforeData: beforeSnapshot,
      afterData: afterSnapshot,
      requestId,
    });
    await tx.insert(auditLogs).values({
      action: "config.skill.update",
      entityType: "skill",
      entityId: before.id,
      configSetId: lockedSet.id,
      requestId,
      details: {
        entityCode: before.code,
        entityRevision: after.revision,
        configSetRevision: lockedSet.currentRevision + 1,
      },
    });

    return {
      configSet: lockedSet.code,
      configSetRevision: lockedSet.currentRevision + 1,
      skill: editableSkill(after),
    };
  });
}

function snapshot(row: typeof skillSelection extends never ? never : Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => key !== "id" && key !== "configSetId"));
}

function editableSkill(row: Record<string, unknown>) {
  return snapshot(row);
}
