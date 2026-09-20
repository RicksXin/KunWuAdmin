import { requireConfigAdmin } from "@/server/http/config-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { configErrorResponse, requestIdFor } from "@/server/http/config-errors";
import {
  acknowledgeChangeWarnings,
  reviewChangeRequest,
  submitChangeRequest,
} from "@/server/services/config-change-request";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("acknowledge_warnings"), reason: z.string().trim().min(2).max(1000) }),
  z.object({ action: z.literal("approve"), reviewNotes: z.string().trim().max(5000).nullable().default(null) }),
  z.object({ action: z.literal("reject"), reviewNotes: z.string().trim().min(2).max(5000) }),
]);

export async function POST(request: Request, context: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    await requireConfigAdmin(request,"release.review");
    const id = z.string().uuid().parse((await context.params).id);
    const body = actionSchema.parse(await request.json());
    const result = body.action === "submit"
      ? await submitChangeRequest(id, requestId)
      : body.action === "acknowledge_warnings"
        ? await acknowledgeChangeWarnings(id, body.reason, requestId)
        : await reviewChangeRequest(id, body.action, body.reviewNotes, requestId);
    return NextResponse.json(result, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return configErrorResponse(error, requestId, "变更单操作失败");
  }
}
