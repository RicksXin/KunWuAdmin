import {NextResponse} from 'next/server';
import {z} from 'zod';
import {and,eq} from 'drizzle-orm';
import {database} from '@/server/db/client';
import {configSets,gameParameters,i18nTexts} from '@/db/schema';
import {readMapSource} from '@/server/services/map-source';
import {map01LoopSchema} from '@/server/domain/encounters/loop';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{code:string}>}){
 const {code}=await params;
 const setCode=z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).safeParse(new URL(request.url).searchParams.get('configSet')??'v1_0');
 if(!setCode.success||!/^map_[a-z0-9_]+$/.test(code))return NextResponse.json({message:'地图或配置集参数无效'},{status:400});
 try{
  const [set]=await database.select({id:configSets.id,revision:configSets.currentRevision}).from(configSets).where(eq(configSets.code,setCode.data));
  if(!set)return NextResponse.json({message:'配置集不存在'},{status:404});
  const map=await readMapSource(database,set.id,code);
  if(!map)return NextResponse.json({message:'该地图尚未导入连续坐标详情'},{status:404});
  const [loopRow]=await database.select({value:gameParameters.jsonValue}).from(gameParameters).where(and(eq(gameParameters.configSetId,set.id),eq(gameParameters.code,'map01_loop')));
  const loop=map01LoopSchema.safeParse(loopRow?.value);
  const names=await database.select({code:i18nTexts.code,text:i18nTexts.text}).from(i18nTexts).where(and(eq(i18nTexts.configSetId,set.id),eq(i18nTexts.locale,'zh-CN')));
  return NextResponse.json({...map,configSet:setCode.data,configRevision:set.revision,encounters:loop.success?loop.data.combat.encounters:[],names:Object.fromEntries(names.map(n=>[n.code,n.text]))});
 }catch(error){console.error('MAP_SOURCE_READ_FAILED',error);return NextResponse.json({message:'地图详情读取失败'},{status:500});}
}
