import { NextResponse } from "next/server";
import { simulationInputSchema, baselineRules } from "@/server/domain/resources/rules";
import { createSimulation, productionStatus, settle } from "@/server/domain/resources/settle";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const raw = await request.text();
  if (raw.length > 16384) return NextResponse.json({error:"请求过大"},{status:413,headers});
  let body: unknown;
  try { body=JSON.parse(raw); } catch { return NextResponse.json({error:"请求必须为 JSON"},{status:400,headers}); }
  const parsed=simulationInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({error:parsed.error.issues.map(i => i.message).join("；")},{status:400,headers});
  const input=parsed.data;
  const assigned=createSimulation(input,baselineRules);
  const result=settle(assigned,input.durationSeconds*1000,baselineRules,[],20000);
  // Bounded, stateless simulation only. Never label a partial settlement as complete.
  if (!result.complete) return NextResponse.json({error:"当前组合超出单次模拟计算预算，请缩短时长后重试；未截断或发放收益。"},{status:422,headers});
  return NextResponse.json({rulesId:baselineRules.releaseId,complete:true,state:result.state,
    statuses:productionStatus(result.state,baselineRules),report:{...result.report,events:undefined},eventCount:result.report.events.length}, {headers});
}
