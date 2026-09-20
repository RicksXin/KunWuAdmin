import { z } from "zod";
import { requireConfigAdmin } from "@/server/http/config-auth";
import { reply, failure, jsonBody } from "@/server/http/resource-http";
import { mutationSchema } from "@/server/domain/items/config";
import { itemWorkspace, saveItemConfig, ItemConfigError } from "@/server/services/item-config";
const setSchema=z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).max(64);
export const dynamic="force-dynamic";
function error(e:unknown){return e instanceof ItemConfigError?reply({error:{message:e.message}},e.status):failure(e);}
export async function GET(request:Request){try{await requireConfigAdmin(request);const set=new URL(request.url).searchParams.get("configSet");return reply(await itemWorkspace(set?setSchema.parse(set):undefined));}catch(e){return error(e);}}
export async function POST(request:Request){try{const actor=await requireConfigAdmin(request,"config.write");const body=z.object({configSet:setSchema,mutation:mutationSchema}).strict().parse(await jsonBody(request));return reply(await saveItemConfig(body.configSet,body.mutation,actor.id,crypto.randomUUID()));}catch(e){return error(e);}}
