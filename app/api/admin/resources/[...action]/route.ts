import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resources,reply,failure,jsonBody,key,token,adminOrigin,requestOrigin } from "@/server/http/resource-http";
import { adjustSchema,ResourceError } from "@/server/services/resource-service";
import { createSimulation,productionStatus,settle } from "@/server/domain/resources/settle";
import { rulesSchema,singleCycleRules,simulationInputSchema } from "@/server/domain/resources/rules";
export const runtime="nodejs";
type Context={params:Promise<{action:string[]}>};
const configSchema=z.object({action:z.enum(["save","approve","publish"]),revision:z.number().int().positive(),rules:rulesSchema.optional(),reason:z.string().trim().min(2).max(500)}).strict();
export async function POST(request:Request,context:Context) {
  try {
    adminOrigin(request);const action=(await context.params).action;
    if(action.join("/")==="local-login") {
      const url=new URL(requestOrigin(request));
      if(!['127.0.0.1','localhost'].includes(url.hostname)||request.headers.get("origin")!==url.origin)throw new ResourceError("FORBIDDEN",403);
      if(process.env.KUNWU_ALLOW_LOCAL_RESOURCE_LOGIN!=="1")throw new ResourceError("LOCAL_LOGIN_DISABLED",403);
      const local=JSON.parse(await readFile(path.join(process.cwd(),".local/resource-development.json"),"utf8"));
      const actor=await resources.authenticate(local.adminToken,"admin");
      if(actor.environment!=="development")throw new ResourceError("FORBIDDEN",403);
      const response=reply({ok:true});response.cookies.set("kw_resource_admin",local.adminToken,{httpOnly:true,sameSite:"strict",secure:url.protocol==="https:",path:"/api/admin/resources",maxAge:3600});return response;
    }
    if(action.join("/")==="logout") {const response=reply({ok:true});response.cookies.set("kw_resource_admin","",{path:"/api/admin/resources",maxAge:0});return response;}
    const actor=await resources.authenticate(token(request,"admin"),"admin");
    if(action.join("/")==="simulate") {
      const input=simulationInputSchema.parse(await jsonBody(request));
      const config=await resources.configuration(actor);const rules=singleCycleRules(rulesSchema.parse(config.draft?.rules));
      const state=createSimulation(input,rules);
      const result=settle(state,input.durationSeconds*1000,rules);
      if(!result.complete)throw new ResourceError("SIMULATION_BUDGET",422);
      return reply({...result,rulesId:rules.releaseId,statuses:productionStatus(result.state,rules),report:{...result.report,events:undefined}});
    }
    if(action.join("/")==="configuration")return reply(await resources.configure(actor,configSchema.parse(await jsonBody(request))));
    if(action.length===3&&action[0]==="players") {
      const [,,operation]=action;
      if(operation==="sync") {const result=await resources.execute(actor,action[1],key(request),{type:"sync"});return reply(result.body,result.status);}
      if(operation==="adjust") {const result=await resources.execute(actor,action[1],key(request),adjustSchema.parse(await jsonBody(request)));return reply(result.body,result.status);}
    }
    throw new ResourceError("NOT_FOUND",404);
  }catch(e){return failure(e);}
}
export async function GET(request:Request,context:Context) {
  try {
    const actor=await resources.authenticate(token(request,"admin"),"admin"),action=(await context.params).action;
    if(action.join("/")==="session")return reply({id:actor.id,environment:actor.environment,permissions:actor.permissions});
    if(action.join("/")==="players")return reply({players:await resources.list(actor)});
    if(action.join("/")==="configuration")return reply(await resources.configuration(actor));
    if(action.length===3&&action[0]==="players"&&action[2]==="ledger")return reply({entries:await resources.ledgerPage(actor,action[1])});
    throw new ResourceError("NOT_FOUND",404);
  }catch(e){return failure(e);}
}
