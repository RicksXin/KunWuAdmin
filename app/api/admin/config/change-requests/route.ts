import { requireConfigAdmin } from "@/server/http/config-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { configErrorResponse, errorResponse, requestIdFor } from "@/server/http/config-errors";
import { createChangeRequest, getChangeRequestWorkspace } from "@/server/services/config-change-request";

export const dynamic = "force-dynamic";
const configSetSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);

export async function GET(request: Request) {
  const requestId = requestIdFor(request);
  const configSet = configSetSchema.safeParse(new URL(request.url).searchParams.get("configSet") ?? "demo_d0");
  if (!configSet.success) return errorResponse("INVALID_REQUEST", "配置集参数无效", requestId, 400);
  try {
    return NextResponse.json(await getChangeRequestWorkspace(configSet.data), { headers: { "x-request-id": requestId } });
  } catch (error) {
    return configErrorResponse(error, requestId, "变更单读取失败");
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  try {
    await requireConfigAdmin(request,"config.write");
    const body = z.object({
      configSet: configSetSchema,
      title: z.string().trim().min(2).max(160),
      description: z.string().trim().max(5000).nullable().default(null),
    }).parse(await request.json());
    return NextResponse.json(await createChangeRequest(body.configSet, body.title, body.description, requestId), { status: 201, headers: { "x-request-id": requestId } });
  } catch (error) {
    return configErrorResponse(error, requestId, "变更单创建失败");
  }
}
