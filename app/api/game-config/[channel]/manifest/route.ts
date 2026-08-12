import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublishedManifest, ReleaseNotFoundError } from "@/server/services/config-release";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ channel: string }> };

export async function GET(request: Request, context: RouteContext) {
  const channel = z.enum(["development", "staging", "production"]).safeParse((await context.params).channel);
  if (!channel.success) return NextResponse.json({ message: "配置渠道不存在" }, { status: 404 });
  try {
    const manifest = await getPublishedManifest(channel.data);
    const etag = `"manifest-${channel.data}-${manifest.sequence}"`;
    if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "public, max-age=30, must-revalidate" } });
    return NextResponse.json(manifest, { headers: { ETag: etag, "Cache-Control": "public, max-age=30, must-revalidate" } });
  } catch (error) {
    if (error instanceof ReleaseNotFoundError) return NextResponse.json({ message: "当前渠道尚无已发布配置" }, { status: 404 });
    console.error("GAME_CONFIG_MANIFEST_FAILED", error);
    return NextResponse.json({ message: "配置清单读取失败" }, { status: 500 });
  }
}
