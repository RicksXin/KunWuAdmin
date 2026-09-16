import { NextResponse } from "next/server";
import { z } from "zod";
import { databasePool } from "@/server/db/client";
import { publishedRecruitment } from "@/server/services/recruitment-config";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(_request: Request, context: {params: Promise<{channel: string}>}) {
  const channel = z.enum(["development", "staging", "production"]).safeParse((await context.params).channel);
  const headers = {"Cache-Control": "no-store"};
  if (!channel.success) return NextResponse.json({message: "配置渠道不存在"}, {status: 404, headers});
  try {
    const config = await publishedRecruitment(databasePool, channel.data);
    return config ? NextResponse.json(config, {headers}) : NextResponse.json({message: "当前渠道尚无已发布招募配置"}, {status: 404, headers});
  } catch {
    return NextResponse.json({message: "招募配置读取或校验失败"}, {status: 503, headers});
  }
}
