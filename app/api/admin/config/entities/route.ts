import { NextResponse } from "next/server";
import { z } from "zod";
import { configModuleSchema, ConfigSetNotFoundError, listConfigModuleEntities } from "@/server/services/config-query";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  configSet: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).default("demo_d0"),
  module: configModuleSchema.default("base"),
});

export async function GET(request: Request) {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ message: "查询参数无效", issues: query.error.issues }, { status: 400 });
  try {
    return NextResponse.json(await listConfigModuleEntities(query.data.configSet, query.data.module));
  } catch (error) {
    if (error instanceof ConfigSetNotFoundError) return NextResponse.json({ message: "配置集不存在" }, { status: 404 });
    console.error("CONFIG_ENTITIES_FAILED", error);
    return NextResponse.json({ message: "配置明细查询失败" }, { status: 500 });
  }
}
