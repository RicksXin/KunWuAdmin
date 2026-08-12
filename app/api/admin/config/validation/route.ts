import { NextResponse } from "next/server";
import { z } from "zod";
import { configErrorResponse, errorResponse, requestIdFor } from "@/server/http/config-errors";
import { getLatestConfigValidation, runConfigValidation } from "@/server/services/config-validation";

export const dynamic = "force-dynamic";
const configSetSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);

export async function GET(request: Request) {
  const requestId = requestIdFor(request);
  const configSet = configSetSchema.safeParse(new URL(request.url).searchParams.get("configSet") ?? "demo_d0");
  if (!configSet.success) return errorResponse("INVALID_REQUEST", "配置集参数无效", requestId, 400);
  try {
    return NextResponse.json(await getLatestConfigValidation(configSet.data), { headers: { "x-request-id": requestId } });
  } catch (error) {
    return configErrorResponse(error, requestId, "校验记录读取失败");
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const body = z.object({ configSet: configSetSchema.default("demo_d0") }).parse(await request.json());
    return NextResponse.json(await runConfigValidation(body.configSet), { headers: { "x-request-id": requestId } });
  } catch (error) {
    return configErrorResponse(error, requestId, "配置校验失败");
  }
}
