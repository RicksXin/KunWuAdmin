import {z} from "zod";
import {and,eq} from "drizzle-orm";
import {database} from "@/server/db/client";
import {configSets,enemies,encounters,i18nTexts} from "@/db/schema";
import {requireConfigAdmin} from "@/server/http/config-auth";
import {reply,failure} from "@/server/http/resource-http";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{
  await requireConfigAdmin(request);
  const q=z.object({configSet:z.string().regex(/^[a-z0-9_-]+$/),kind:z.enum(["enemy","encounter"]),code:z.string().regex(/^[a-z0-9_]+$/)}).parse(Object.fromEntries(new URL(request.url).searchParams));
  const [set]=await database.select({id:configSets.id}).from(configSets).where(eq(configSets.code,q.configSet));if(!set)return reply({error:{message:"配置集不存在"}},404);
  const [row]=q.kind==="enemy"?await database.select({code:enemies.code,nameKey:enemies.nameKey,design:enemies.design,runtime:enemies.runtime,level:enemies.level,hp:enemies.maxHp,strength:enemies.strength,magic:enemies.magic,technique:enemies.technique,speed:enemies.speed,constitution:enemies.constitution,armor:enemies.armor,resistance:enemies.resistance,model:enemies.modelAssetKey,portrait:enemies.portraitAssetKey}).from(enemies).where(and(eq(enemies.configSetId,set.id),eq(enemies.code,q.code))):await database.select({code:encounters.code,nameKey:encounters.nameKey,design:encounters.design}).from(encounters).where(and(eq(encounters.configSetId,set.id),eq(encounters.code,q.code)));
  if(!row?.design)return reply({error:{message:"该条目没有新版设计草稿"}},404);
  const [name]=row.nameKey ? await database.select({text:i18nTexts.text}).from(i18nTexts).where(and(eq(i18nTexts.configSetId,set.id),eq(i18nTexts.code,row.nameKey),eq(i18nTexts.locale,"zh-CN"))) : [];
  return reply({kind:q.kind,code:row.code,name:name?.text??row.code,design:row.design,...("runtime" in row?{runtime:row.runtime,attributes:{level:row.level,hp:row.hp,strength:row.strength,magic:row.magic,technique:row.technique,speed:row.speed,constitution:row.constitution,armor:row.armor,resistance:row.resistance},model:row.model,portrait:row.portrait}:{})});
}catch(error){return failure(error);}}
