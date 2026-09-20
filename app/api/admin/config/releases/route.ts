import { requireConfigAdmin } from "@/server/http/config-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { configErrorResponse, errorResponse, requestIdFor } from "@/server/http/config-errors";
import { buildDevelopmentRelease, getReleaseWorkspace } from "@/server/services/config-release";

export const dynamic = "force-dynamic";
const configSetSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);

export async function GET(request: Request) {
  const requestId = requestIdFor(request);
  const configSet = configSetSchema.safeParse(new URL(request.url).searchParams.get("configSet") ?? "demo_d0");
  if (!configSet.success) return errorResponse("INVALID_REQUEST", "配置集参数无效", requestId, 400);
  try {
    return NextResponse.json(await getReleaseWorkspace(configSet.data), { headers: { "x-request-id": requestId } });
  } catch (error) {
    return configErrorResponse(error, requestId, "发布状态读取失败");
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  try {
    await requireConfigAdmin(request,"release.build");
    const body = z.object({ configSet: configSetSchema, mode: z.enum(["preview", "publish"]).default("preview") }).parse(await request.json());
    return NextResponse.json(await buildDevelopmentRelease(body.configSet, body.mode, requestId), { status: 201, headers: { "x-request-id": requestId } });
  } catch (error) {
    return configErrorResponse(error, requestId, "配置编译失败");
  }
}
