import { NextResponse } from "next/server";
import { z } from "zod";
import { configErrorResponse, errorResponse, requestIdFor } from "@/server/http/config-errors";
import { getSkill, skillUpdateSchema, updateSkill } from "@/server/services/config-skill";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> };
const configSetSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);

export async function GET(request: Request, context: RouteContext) {
  const requestId = requestIdFor(request);
  const configSet = configSetSchema.safeParse(new URL(request.url).searchParams.get("configSet") ?? "demo_d0");
  if (!configSet.success) return errorResponse("INVALID_REQUEST", "配置集参数无效", requestId, 400);
  try {
    const { code } = await context.params;
    return NextResponse.json(await getSkill(configSet.data, code), { headers: { "x-request-id": requestId } });
  } catch (error) {
    return configErrorResponse(error, requestId, "技能读取失败");
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const requestId = requestIdFor(request);
  const configSet = configSetSchema.safeParse(new URL(request.url).searchParams.get("configSet") ?? "demo_d0");
  if (!configSet.success) return errorResponse("INVALID_REQUEST", "配置集参数无效", requestId, 400);
  try {
    const body = skillUpdateSchema.parse(await request.json());
    const { code } = await context.params;
    return NextResponse.json(await updateSkill(configSet.data, code, body, requestId), { headers: { "x-request-id": requestId } });
  } catch (error) {
    return configErrorResponse(error, requestId, "技能保存失败");
  }
}
