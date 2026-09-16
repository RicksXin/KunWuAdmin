import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { databasePool } from "../db/client";
import { ResourceError, ResourceService } from "../services/resource-service";

export const resources=new ResourceService(databasePool);
export function reply(body:unknown,status=200) {return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});}
export function failure(e:unknown) {
  if(e instanceof ZodError)return reply({error:{code:"VALIDATION_FAILED",message:e.issues.map(x=>`${x.path.join(".")||"配置"}: ${x.message}`).join("；")}},400);
  const code=e instanceof Error?e.message:"INTERNAL_ERROR";
  const messages:Record<string,string>={UNAUTHENTICATED:"请先连接身份",LOCAL_LOGIN_DISABLED:"本机开发身份连接未启用，请使用 pnpm resources:dev 启动；构建后使用 pnpm resources:start 启动。",FORBIDDEN:"没有此操作权限",STATE_CONFLICT:"数据已更新，请刷新后重试",INSUFFICIENT_RESOURCE:"资源不足",WORKER_LIMIT:"杂役人数已达上限",STORAGE_LIMIT:"储量已满级",RESOURCE_LOCKED:"资源尚未解锁",INVALID_BALANCE:"余额不能为负或增加到容量以上",PLAYER_BUSY:"正在补算，请恢复原请求",RELEASE_BLOCKED:"当前版本尚未审核",RULES_UNAVAILABLE:"配置暂不可用",SIMULATION_BUDGET:"超出单次模拟预算，请缩短时长；未截断或发放收益",IDEMPOTENCY_CONFLICT:"同一请求不能更改内容",TIME_INVALID:"服务端时间异常，请稍后重试"};
  if(e instanceof ResourceError)return reply({error:{code:e.code,message:messages[e.code]??e.code}},e.status);
  if(messages[code])return reply({error:{code,message:messages[code]}},422);
  console.error("RESOURCE_API_FAILED",e instanceof Error?e.name:"unknown");return reply({error:{code:"INTERNAL_ERROR",message:"操作失败，请使用原请求重试"}},500);
}
export async function jsonBody(request:Request) {
  const raw=await request.text();if(raw.length>32768)throw new ResourceError("BODY_TOO_LARGE",413);
  try{return JSON.parse(raw);}catch{throw new ResourceError("INVALID_JSON",400);}
}
export function key(request:Request) {const value=request.headers.get("idempotency-key");if(!value)throw new ResourceError("INVALID_REQUEST_ID",400);return value;}
export function token(request:Request,kind:"player"|"admin") {
  const bearer=request.headers.get("authorization");if(bearer?.startsWith("Bearer "))return bearer.slice(7);
  if(kind==="admin")return (request.headers.get("cookie")??"").split(";").map(s=>s.trim()).find(s=>s.startsWith("kw_resource_admin="))?.slice("kw_resource_admin=".length)??"";
  return "";
}
export function requestOrigin(request:Request) {
  const url=new URL(request.url);return new URL(`${url.protocol}//${request.headers.get("host")??url.host}`).origin;
}
export function adminOrigin(request:Request) {
  if(request.method==="GET"||request.headers.get("authorization"))return;
  if(request.headers.get("origin")!==requestOrigin(request))throw new ResourceError("FORBIDDEN",403);
}
