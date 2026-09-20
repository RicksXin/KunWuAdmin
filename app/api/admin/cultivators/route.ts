import { z } from "zod";
import { requireConfigAdmin } from "@/server/http/config-auth";
import { reply, failure, jsonBody } from "@/server/http/resource-http";
import { probabilityUpdateSchema,mutationSchema } from "@/server/domain/cultivators/config";
import { saveTemplateProbabilities,cultivatorWorkspace, saveCultivatorConfig, CultivatorConfigError } from "@/server/services/cultivator-config";
const setSchema=z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).max(64);
export const dynamic="force-dynamic";
function error(e:unknown){return e instanceof CultivatorConfigError?reply({error:{message:e.message}},e.status):failure(e);}
export async function GET(request:Request){try{await requireConfigAdmin(request);const set=new URL(request.url).searchParams.get("configSet");return reply(await cultivatorWorkspace(set?setSchema.parse(set):undefined));}catch(e){return error(e);}}
export async function POST(request:Request){try{const actor=await requireConfigAdmin(request,"config.write");const body=z.object({configSet:setSchema,mutation:mutationSchema}).strict().parse(await jsonBody(request));return reply(await saveCultivatorConfig(body.configSet,body.mutation,actor.id,crypto.randomUUID()));}catch(e){return error(e);}}

export async function PUT(request:Request){try{const actor=await requireConfigAdmin(request,"config.write");const body=z.object({configSet:setSchema,probabilities:probabilityUpdateSchema}).strict().parse(await jsonBody(request));return reply(await saveTemplateProbabilities(body.configSet,body.probabilities,actor.id,crypto.randomUUID()));}catch(e){return error(e);}}
