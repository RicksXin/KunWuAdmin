import { z } from "zod";
import { getPublishedModule, ReleaseNotFoundError } from "@/server/services/config-release";
import { releaseModuleCodes } from "@/server/compiler/config-compiler";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ channel: string; releaseId: string; moduleCode: string }> };

export async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  const parsed = z.object({
    channel: z.enum(["development", "staging", "production"]),
    releaseId: z.string().uuid(),
    moduleCode: z.enum(releaseModuleCodes),
  }).safeParse(params);
  if (!parsed.success) return Response.json({ message: "配置模块不存在" }, { status: 404 });
  try {
    const releaseModule = await getPublishedModule(parsed.data.channel, parsed.data.releaseId, parsed.data.moduleCode);
    const etag = `"sha256-${releaseModule.sha256Hex}"`;
    const headers = { ETag: etag, "Cache-Control": "public, max-age=31536000, immutable", "Content-Type": "application/json; charset=utf-8", "Content-Encoding": "gzip" };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(releaseModule.artifact), { headers });
  } catch (error) {
    if (error instanceof ReleaseNotFoundError) return Response.json({ message: "配置模块不存在" }, { status: 404 });
    console.error("GAME_CONFIG_MODULE_FAILED", error);
    return Response.json({ message: "配置模块读取失败" }, { status: 500 });
  }
}
