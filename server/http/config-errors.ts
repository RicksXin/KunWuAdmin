import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ConfigSetNotFoundError } from "@/server/services/config-query";
import { RevisionConflictError, SkillNotFoundError } from "@/server/services/config-skill";
import { ReleaseBlockedError, ReleaseNotFoundError } from "@/server/services/config-release";
import { ChangeRequestBlockedError, ChangeRequestNotFoundError, ChangeRequestStateError } from "@/server/services/config-change-request";

export function requestIdFor(request: Request) {
  return request.headers.get("x-request-id")?.slice(0, 64) || crypto.randomUUID();
}

export function configErrorResponse(error: unknown, requestId: string, fallbackMessage: string) {
  if (error instanceof ConfigSetNotFoundError || error instanceof SkillNotFoundError) {
    return errorResponse("NOT_FOUND", "配置实体不存在", requestId, 404);
  }
  if (error instanceof RevisionConflictError) {
    return errorResponse("REVISION_CONFLICT", "配置已被其他人修改", requestId, 409);
  }
  if (error instanceof ReleaseBlockedError) {
    return NextResponse.json({ error: { code: "RELEASE_BLOCKED", message: "发布门禁未通过", fieldErrors: [], requestId, reasons: error.reasons } }, { status: 409, headers: { "x-request-id": requestId } });
  }
  if (error instanceof ReleaseNotFoundError) {
    return errorResponse("NOT_FOUND", "发布或模块不存在", requestId, 404);
  }
  if (error instanceof ChangeRequestNotFoundError) {
    return errorResponse("NOT_FOUND", "变更单不存在", requestId, 404);
  }
  if (error instanceof ChangeRequestStateError) {
    return errorResponse("INVALID_STATE", "变更单当前状态不允许此操作", requestId, 409);
  }
  if (error instanceof ChangeRequestBlockedError) {
    return NextResponse.json({ error: { code: "CHANGE_REQUEST_BLOCKED", message: "变更单门禁未通过", fieldErrors: [], requestId, reasons: error.reasons } }, { status: 409, headers: { "x-request-id": requestId } });
  }
  if (error instanceof ZodError) {
    return errorResponse("VALIDATION_FAILED", "提交内容不合法", requestId, 400,
      error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })));
  }
  console.error("CONFIG_API_FAILED", { requestId, error });
  return errorResponse("INTERNAL_ERROR", fallbackMessage, requestId, 500);
}

export function errorResponse(code: string, message: string, requestId: string, status: number, fieldErrors: { field: string; message: string }[] = []) {
  return NextResponse.json({ error: { code, message, fieldErrors, requestId } }, { status, headers: { "x-request-id": requestId } });
}
