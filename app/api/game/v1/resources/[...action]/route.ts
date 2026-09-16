import { resources,reply,failure,jsonBody,key,token } from "@/server/http/resource-http";
import { playerCommandSchema,ResourceError } from "@/server/services/resource-service";
export const runtime="nodejs";
type Context={params:Promise<{action:string[]}>};
export async function POST(request:Request,context:Context) {
  try {
    const action=(await context.params).action.join("/");
    if(!["sync","command"].includes(action))throw new ResourceError("NOT_FOUND",404);
    const actor=await resources.authenticate(token(request,"player"),"player");
    const operation=playerCommandSchema.parse(action==="sync"?{type:"sync"}:await jsonBody(request));
    const result=await resources.execute(actor,actor.id,key(request),operation);return reply(result.body,result.status);
  }catch(e){return failure(e);}
}
export async function GET(request:Request,context:Context) {
  try {
    const actions=(await context.params).action;
    if(actions.length!==2||actions[0]!=="requests")throw new ResourceError("NOT_FOUND",404);
    const actor=await resources.authenticate(token(request,"player"),"player");
    const result=await resources.request(actor,actor.id,actions[1]);return reply(result.body,result.status);
  }catch(e){return failure(e);}
}
