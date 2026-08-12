import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  auditLogs,
  configChangeRequests,
  configChangeWarningAcks,
  configSets,
  configValidationIssues,
  configValidationRuns,
} from "@/db/schema";
import { database } from "@/server/db/client";
import { ConfigSetNotFoundError } from "./config-query";

export class ChangeRequestNotFoundError extends Error {}
export class ChangeRequestBlockedError extends Error {
  constructor(public readonly reasons: string[]) {
    super("Change request action is blocked");
  }
}
export class ChangeRequestStateError extends Error {}

export async function getChangeRequestWorkspace(configSetCode: string) {
  const [configSet] = await database.select({ id: configSets.id, code: configSets.code, currentRevision: configSets.currentRevision })
    .from(configSets).where(eq(configSets.code, configSetCode)).limit(1);
  if (!configSet) throw new ConfigSetNotFoundError(`Config set ${configSetCode} was not found`);

  const changeRows = await database.select({
    id: configChangeRequests.id,
    sourceRevision: configChangeRequests.sourceRevision,
    title: configChangeRequests.title,
    description: configChangeRequests.description,
    status: configChangeRequests.status,
    validationRunId: configChangeRequests.validationRunId,
    submittedAt: configChangeRequests.submittedAt,
    reviewedAt: configChangeRequests.reviewedAt,
    reviewNotes: configChangeRequests.reviewNotes,
    createdAt: configChangeRequests.createdAt,
    updatedAt: configChangeRequests.updatedAt,
  }).from(configChangeRequests).where(eq(configChangeRequests.configSetId, configSet.id))
    .orderBy(desc(configChangeRequests.createdAt)).limit(20);
  const current = changeRows.find((item) => item.sourceRevision === configSet.currentRevision && item.status !== "superseded") ?? changeRows[0] ?? null;

  const validationRunId = current?.validationRunId;
  const issues = validationRunId ? await database.select({
    id: configValidationIssues.id,
    severity: configValidationIssues.severity,
    moduleCode: configValidationIssues.moduleCode,
    entityType: configValidationIssues.entityType,
    entityCode: configValidationIssues.entityCode,
    ruleCode: configValidationIssues.ruleCode,
    message: configValidationIssues.message,
  }).from(configValidationIssues).where(eq(configValidationIssues.validationRunId, validationRunId))
    .orderBy(configValidationIssues.severity, configValidationIssues.moduleCode, configValidationIssues.ruleCode, configValidationIssues.entityCode) : [];
  const acknowledgements = current ? await database.select({
    validationIssueId: configChangeWarningAcks.validationIssueId,
    reason: configChangeWarningAcks.reason,
    acknowledgedAt: configChangeWarningAcks.acknowledgedAt,
  }).from(configChangeWarningAcks).where(eq(configChangeWarningAcks.changeRequestId, current.id)) : [];
  const ackByIssue = new Map(acknowledgements.map((item) => [item.validationIssueId, item]));

  return {
    configSet: configSet.code,
    currentRevision: configSet.currentRevision,
    current: current ? {
      ...current,
      stale: current.sourceRevision !== configSet.currentRevision,
      issues: issues.map((item) => ({ ...item, acknowledged: ackByIssue.has(item.id), acknowledgementReason: ackByIssue.get(item.id)?.reason ?? null })),
      warningCount: issues.filter((item) => item.severity === "warning").length,
      acknowledgedWarningCount: issues.filter((item) => item.severity === "warning" && ackByIssue.has(item.id)).length,
      errorCount: issues.filter((item) => item.severity === "error").length,
    } : null,
    recent: changeRows,
  };
}

export async function createChangeRequest(configSetCode: string, title: string, description: string | null, requestId: string) {
  return database.transaction(async (tx) => {
    const [configSet] = await tx.select({ id: configSets.id, code: configSets.code, currentRevision: configSets.currentRevision })
      .from(configSets).where(eq(configSets.code, configSetCode)).limit(1).for("update");
    if (!configSet) throw new ConfigSetNotFoundError(`Config set ${configSetCode} was not found`);
    const [existing] = await tx.select({ id: configChangeRequests.id, status: configChangeRequests.status })
      .from(configChangeRequests).where(and(
        eq(configChangeRequests.configSetId, configSet.id),
        eq(configChangeRequests.sourceRevision, configSet.currentRevision),
        inArray(configChangeRequests.status, ["draft", "submitted", "approved"]),
      )).orderBy(desc(configChangeRequests.createdAt)).limit(1);
    if (existing) throw new ChangeRequestBlockedError([`当前修订已有${statusName(existing.status)}变更单`]);

    const id = uuidv7();
    await tx.insert(configChangeRequests).values({
      id,
      configSetId: configSet.id,
      sourceRevision: configSet.currentRevision,
      title,
      description,
      status: "draft",
    });
    await tx.insert(auditLogs).values({
      action: "config.change_request.create",
      entityType: "config_change_request",
      entityId: id,
      configSetId: configSet.id,
      requestId,
      details: { title, sourceRevision: configSet.currentRevision },
    });
    return { id, configSet: configSet.code, sourceRevision: configSet.currentRevision, title, description, status: "draft" };
  });
}

export async function submitChangeRequest(changeRequestId: string, requestId: string) {
  return withLockedRequest(changeRequestId, async ({ tx, change, configSet }) => {
    requireState(change.status, ["draft"]);
    const reasons: string[] = [];
    if (change.sourceRevision !== configSet.currentRevision) reasons.push("配置集已产生新修订，请新建变更单");
    const [validation] = await tx.select().from(configValidationRuns).where(and(
      eq(configValidationRuns.configSetId, configSet.id),
      eq(configValidationRuns.sourceRevision, configSet.currentRevision),
    )).orderBy(desc(configValidationRuns.createdAt)).limit(1);
    if (!validation) reasons.push("当前修订尚未执行全量校验");
    else if (!(["passed", "passed_with_warnings"].includes(validation.status)) || validation.errorCount > 0) reasons.push(`全量校验未通过，仍有 ${validation.errorCount} 条阻断问题`);
    if (reasons.length) throw new ChangeRequestBlockedError(reasons);

    const submittedAt = new Date();
    await tx.update(configChangeRequests).set({ status: "submitted", validationRunId: validation!.id, submittedAt }).where(eq(configChangeRequests.id, change.id));
    await writeAudit(tx, change, configSet.id, requestId, "config.change_request.submit", { validationRunId: validation!.id });
    return { id: change.id, status: "submitted", validationRunId: validation!.id, submittedAt };
  });
}

export async function acknowledgeChangeWarnings(changeRequestId: string, reason: string, requestId: string) {
  return withLockedRequest(changeRequestId, async ({ tx, change, configSet }) => {
    requireState(change.status, ["submitted"]);
    if (!change.validationRunId) throw new ChangeRequestBlockedError(["变更单未绑定校验记录"]);
    const warnings = await tx.select({ id: configValidationIssues.id }).from(configValidationIssues).where(and(
      eq(configValidationIssues.validationRunId, change.validationRunId),
      eq(configValidationIssues.severity, "warning"),
    ));
    for (const warning of warnings) {
      await tx.insert(configChangeWarningAcks).values({
        changeRequestId: change.id,
        validationIssueId: warning.id,
        reason,
      }).onDuplicateKeyUpdate({ set: { reason } });
    }
    await writeAudit(tx, change, configSet.id, requestId, "config.change_request.acknowledge_warnings", { warningCount: warnings.length, reason });
    return { id: change.id, status: change.status, acknowledgedWarningCount: warnings.length };
  });
}

export async function reviewChangeRequest(changeRequestId: string, decision: "approve" | "reject", reviewNotes: string | null, requestId: string) {
  return withLockedRequest(changeRequestId, async ({ tx, change, configSet }) => {
    requireState(change.status, ["submitted"]);
    if (change.sourceRevision !== configSet.currentRevision) throw new ChangeRequestBlockedError(["配置集已产生新修订，当前审核已过期"]);
    if (!change.validationRunId) throw new ChangeRequestBlockedError(["变更单未绑定校验记录"]);

    if (decision === "approve") {
      const [validation] = await tx.select().from(configValidationRuns).where(eq(configValidationRuns.id, change.validationRunId)).limit(1);
      if (!validation || validation.sourceRevision !== configSet.currentRevision || validation.errorCount > 0 || !["passed", "passed_with_warnings"].includes(validation.status)) {
        throw new ChangeRequestBlockedError(["绑定的全量校验不是当前修订的成功结果"]);
      }
      const warningRows = await tx.select({ id: configValidationIssues.id }).from(configValidationIssues).where(and(eq(configValidationIssues.validationRunId, validation.id), eq(configValidationIssues.severity, "warning")));
      const ackRows = await tx.select({ issueId: configChangeWarningAcks.validationIssueId }).from(configChangeWarningAcks).where(eq(configChangeWarningAcks.changeRequestId, change.id));
      const acked = new Set(ackRows.map((item) => item.issueId));
      const missing = warningRows.filter((item) => !acked.has(item.id)).length;
      if (missing) throw new ChangeRequestBlockedError([`仍有 ${missing} 条校验警告未确认`]);
    }

    const status = decision === "approve" ? "approved" : "rejected";
    const reviewedAt = new Date();
    await tx.update(configChangeRequests).set({ status, reviewedAt, reviewNotes }).where(eq(configChangeRequests.id, change.id));
    await writeAudit(tx, change, configSet.id, requestId, `config.change_request.${decision}`, { reviewNotes });
    return { id: change.id, status, reviewedAt, reviewNotes };
  });
}

type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
async function withLockedRequest<T>(changeRequestId: string, operation: (context: { tx: Transaction; change: typeof configChangeRequests.$inferSelect; configSet: { id: string; currentRevision: number } }) => Promise<T>) {
  return database.transaction(async (tx) => {
    const [change] = await tx.select().from(configChangeRequests).where(eq(configChangeRequests.id, changeRequestId)).limit(1).for("update");
    if (!change) throw new ChangeRequestNotFoundError(`Change request ${changeRequestId} was not found`);
    const [configSet] = await tx.select({ id: configSets.id, currentRevision: configSets.currentRevision }).from(configSets)
      .where(eq(configSets.id, change.configSetId)).limit(1).for("update");
    if (!configSet) throw new ConfigSetNotFoundError("Config set was not found");
    return operation({ tx, change, configSet });
  });
}

function requireState(current: string, allowed: string[]) {
  if (!allowed.includes(current)) throw new ChangeRequestStateError(`Cannot act on change request in ${current}`);
}

async function writeAudit(tx: Transaction, change: typeof configChangeRequests.$inferSelect, configSetId: string, requestId: string, action: string, details: Record<string, unknown>) {
  await tx.insert(auditLogs).values({ action, entityType: "config_change_request", entityId: change.id, configSetId, requestId, details: { sourceRevision: change.sourceRevision, ...details } });
}

function statusName(status: string) {
  const labels: Record<string, string> = { draft: "草稿", submitted: "待审核", approved: "已批准" };
  return labels[status] ?? status;
}
