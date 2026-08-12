import "server-only";

import { and, count, desc, eq, max } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  auditLogs,
  configChangeRequests,
  configChangeWarningAcks,
  configChannelHeads,
  configPublishLocks,
  configReleaseModules,
  configReleases,
  configSets,
  configValidationIssues,
  configValidationRuns,
} from "@/db/schema";
import { compileConfigModules, releaseModuleCodes } from "@/server/compiler/config-compiler";
import { database } from "@/server/db/client";
import { ConfigSetNotFoundError } from "./config-query";

export class ReleaseBlockedError extends Error {
  constructor(public readonly reasons: string[]) {
    super("Release is blocked");
  }
}

export class ReleaseNotFoundError extends Error {}

export async function buildDevelopmentRelease(configSetCode: string, mode: "preview" | "publish", requestId: string) {
  return database.transaction(async (tx) => {
    const [targetSet] = await tx.select({ id: configSets.id }).from(configSets)
      .where(eq(configSets.code, configSetCode)).limit(1);
    if (!targetSet) throw new ConfigSetNotFoundError(`Config set ${configSetCode} was not found`);

    await tx.select({ lockKey: configPublishLocks.lockKey }).from(configPublishLocks)
      .where(eq(configPublishLocks.lockKey, `config-set:${targetSet.id}:build`)).limit(1).for("update");
    await tx.select({ lockKey: configPublishLocks.lockKey }).from(configPublishLocks)
      .where(eq(configPublishLocks.lockKey, "channel:development:publish")).limit(1).for("update");
    const [configSet] = await tx.select({
      id: configSets.id, code: configSets.code, schemaVersion: configSets.schemaVersion,
      currentRevision: configSets.currentRevision,
    }).from(configSets).where(eq(configSets.id, targetSet.id)).limit(1).for("update");
    if (!configSet) throw new ConfigSetNotFoundError(`Config set ${configSetCode} was not found`);

    const [latestValidation] = await tx.select().from(configValidationRuns)
      .where(eq(configValidationRuns.configSetId, configSet.id)).orderBy(desc(configValidationRuns.createdAt)).limit(1);
    const [approvedChange] = await tx.select().from(configChangeRequests).where(and(
      eq(configChangeRequests.configSetId, configSet.id),
      eq(configChangeRequests.sourceRevision, configSet.currentRevision),
      eq(configChangeRequests.status, "approved"),
    )).orderBy(desc(configChangeRequests.reviewedAt)).limit(1);

    if (mode === "publish") {
      const reasons: string[] = [];
      if (!latestValidation) reasons.push("当前修订尚未执行全量校验");
      else {
        if (latestValidation.sourceRevision !== configSet.currentRevision) reasons.push("最新校验已过期，请重新校验当前修订");
        if (!inArrayValue(latestValidation.status, ["passed", "passed_with_warnings"]) || latestValidation.errorCount > 0) reasons.push(`仍有 ${latestValidation.errorCount} 条阻断问题`);
      }
      if (!approvedChange) reasons.push("当前修订尚未审核通过");
      if (approvedChange && latestValidation && approvedChange.validationRunId !== latestValidation.id) reasons.push("审核引用的校验记录不是当前最新校验");
      if (approvedChange && latestValidation && latestValidation.warningCount > 0) {
        const [ackRows] = await tx.select({ value: count() }).from(configChangeWarningAcks)
          .innerJoin(configValidationIssues, eq(configChangeWarningAcks.validationIssueId, configValidationIssues.id))
          .where(and(eq(configChangeWarningAcks.changeRequestId, approvedChange.id), eq(configValidationIssues.severity, "warning")));
        if (Number(ackRows?.value ?? 0) < latestValidation.warningCount) reasons.push("校验警告尚未全部确认");
      }
      if (reasons.length) throw new ReleaseBlockedError(reasons);
    }

    const [sequenceRow] = await tx.select({ value: max(configReleases.sequence) }).from(configReleases)
      .where(eq(configReleases.channel, "development"));
    const sequence = Number(sequenceRow?.value ?? 0) + 1;
    const releaseId = uuidv7();
    const version = mode === "preview" ? `preview-r${configSet.currentRevision}-${sequence}-${releaseId.slice(-6)}` : `dev-r${configSet.currentRevision}-${sequence}`;
    const modules = await compileConfigModules(tx as unknown as typeof database, configSet.id, configSet.schemaVersion, configSet.currentRevision);

    await tx.insert(configReleases).values({
      id: releaseId,
      channel: "development",
      sequence,
      version,
      schemaVersion: configSet.schemaVersion,
      minClientVersion: "0.1.0",
      sourceConfigSetId: configSet.id,
      sourceRevision: configSet.currentRevision,
      changeRequestId: mode === "publish" ? approvedChange?.id : null,
      status: mode === "publish" ? "published" : "preview",
      releaseNotes: mode === "preview" ? "确定性编译预览，不可被客户端读取" : "development 配置发布",
      publishedAt: mode === "publish" ? new Date() : null,
    });
    await tx.insert(configReleaseModules).values(modules.map((module) => ({
      releaseId,
      moduleCode: module.moduleCode,
      moduleSchemaVersion: module.moduleSchemaVersion,
      sha256: module.sha256,
      byteSize: module.byteSize,
      contentEncoding: "gzip",
      payloadJson: module.payload,
      artifact: module.artifact,
    })));

    if (mode === "publish") {
      await tx.select({ channel: configChannelHeads.channel }).from(configChannelHeads)
        .where(eq(configChannelHeads.channel, "development")).limit(1).for("update");
      await tx.update(configChannelHeads).set({ activeReleaseId: releaseId }).where(eq(configChannelHeads.channel, "development"));
      if (approvedChange) await tx.update(configChangeRequests).set({ status: "released" }).where(eq(configChangeRequests.id, approvedChange.id));
    }
    await tx.insert(auditLogs).values({
      action: mode === "publish" ? "config.release.publish" : "config.release.preview",
      entityType: "config_release",
      entityId: releaseId,
      configSetId: configSet.id,
      requestId,
      details: { channel: "development", sequence, version, sourceRevision: configSet.currentRevision, moduleHashes: Object.fromEntries(modules.map(item => [item.moduleCode, item.sha256Hex])) },
    });
    return {
      id: releaseId, channel: "development", sequence, version, status: mode === "publish" ? "published" : "preview",
      sourceRevision: configSet.currentRevision,
      channelHeadUpdated: mode === "publish",
      modules: modules.map(item => ({ code: item.moduleCode, schemaVersion: item.moduleSchemaVersion, sha256: item.sha256Hex, byteSize: item.byteSize, gzipByteSize: item.artifact.byteLength })),
    };
  });
}

export async function getReleaseWorkspace(configSetCode: string) {
  const [configSet] = await database.select({ id: configSets.id, code: configSets.code, currentRevision: configSets.currentRevision })
    .from(configSets).where(eq(configSets.code, configSetCode)).limit(1);
  if (!configSet) throw new ConfigSetNotFoundError(`Config set ${configSetCode} was not found`);
  const [latestValidation, latestRelease, channel] = await Promise.all([
    database.select({ id: configValidationRuns.id, sourceRevision: configValidationRuns.sourceRevision, status: configValidationRuns.status, errorCount: configValidationRuns.errorCount, warningCount: configValidationRuns.warningCount, infoCount: configValidationRuns.infoCount, finishedAt: configValidationRuns.finishedAt })
      .from(configValidationRuns).where(eq(configValidationRuns.configSetId, configSet.id)).orderBy(desc(configValidationRuns.createdAt)).limit(1),
    database.select({ id: configReleases.id, version: configReleases.version, status: configReleases.status, sequence: configReleases.sequence, sourceRevision: configReleases.sourceRevision, createdAt: configReleases.createdAt })
      .from(configReleases).where(and(eq(configReleases.sourceConfigSetId, configSet.id), eq(configReleases.channel, "development"))).orderBy(desc(configReleases.sequence)).limit(1),
    database.select({ activeReleaseId: configChannelHeads.activeReleaseId }).from(configChannelHeads).where(eq(configChannelHeads.channel, "development")).limit(1),
  ]);
  return {
    configSet: configSet.code,
    currentRevision: configSet.currentRevision,
    latestValidation: latestValidation[0] ?? null,
    latestRelease: latestRelease[0] ?? null,
    developmentHeadReleaseId: channel[0]?.activeReleaseId ?? null,
    moduleCodes: releaseModuleCodes,
  };
}

export async function getPublishedManifest(channel: string) {
  const [head] = await database.select({ releaseId: configChannelHeads.activeReleaseId }).from(configChannelHeads)
    .where(eq(configChannelHeads.channel, channel)).limit(1);
  if (!head?.releaseId) throw new ReleaseNotFoundError(`Channel ${channel} has no published release`);
  const [release] = await database.select().from(configReleases).where(and(
    eq(configReleases.id, head.releaseId), eq(configReleases.channel, channel), eq(configReleases.status, "published"),
  )).limit(1);
  if (!release) throw new ReleaseNotFoundError(`Channel ${channel} has no published release`);
  const modules = await database.select({
    code: configReleaseModules.moduleCode, schemaVersion: configReleaseModules.moduleSchemaVersion,
    sha256: configReleaseModules.sha256, byteSize: configReleaseModules.byteSize,
  }).from(configReleaseModules).where(eq(configReleaseModules.releaseId, release.id)).orderBy(configReleaseModules.moduleCode);
  return {
    schemaVersion: release.schemaVersion, channel: release.channel, sequence: release.sequence,
    releaseId: release.id, version: release.version, minClientVersion: release.minClientVersion,
    publishedAt: release.publishedAt,
    modules: Object.fromEntries(modules.map(module => [module.code, {
      schemaVersion: module.schemaVersion, sha256: module.sha256.toString("hex"), byteSize: module.byteSize,
      url: `/api/game-config/${release.channel}/releases/${release.id}/modules/${module.code}`,
    }])),
  };
}

export async function getPublishedModule(channel: string, releaseId: string, moduleCode: string) {
  const [head] = await database.select({ releaseId: configChannelHeads.activeReleaseId }).from(configChannelHeads)
    .where(eq(configChannelHeads.channel, channel)).limit(1);
  if (head?.releaseId !== releaseId) throw new ReleaseNotFoundError(`Release ${releaseId} is not active in ${channel}`);
  const [row] = await database.select({
    releaseId: configReleases.id, sha256: configReleaseModules.sha256, artifact: configReleaseModules.artifact,
  }).from(configReleaseModules).innerJoin(configReleases, eq(configReleaseModules.releaseId, configReleases.id)).where(and(
    eq(configReleases.id, releaseId), eq(configReleases.channel, channel), eq(configReleases.status, "published"),
    eq(configReleaseModules.moduleCode, moduleCode),
  )).limit(1);
  if (!row) throw new ReleaseNotFoundError(`Release module ${moduleCode} was not found`);
  return { artifact: row.artifact, sha256Hex: row.sha256.toString("hex") };
}

function inArrayValue<T>(value: T, values: readonly T[]) { return values.includes(value); }
