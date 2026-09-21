import 'dotenv/config';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {and,eq,inArray,sql} from 'drizzle-orm';
import {v7 as uuid} from 'uuid';
import {database,databasePool} from '../server/db/client';
import {configSets,mapDefinitions,mapObjectPrototypes,mapObjectPlacements,encounters,gameParameters,configEntityRevisions,configChangeRequests,auditLogs} from '../db/schema';
import {ResourceService} from '../server/services/resource-service';
import {splitMap,canonical,without,encounterReferences} from '../server/domain/maps/source';
import {readMapSource} from '../server/services/map-source';
import {map01LoopSchema} from '../server/domain/encounters/loop';
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
async function main(){
 const source=JSON.parse(await readFile('../KunWuGodot/data/maps/map_01.json','utf8'));
 const regions=JSON.parse(await readFile('../KunWuGodot/data/maps/map_01_regions.json','utf8'));
 const {map,header,regionDocument}=splitMap(source,regions);
 const local=JSON.parse(await readFile('.local/resource-development.json','utf8'));
 const actor=await new ResourceService(databasePool).authenticate(local.adminToken,'admin');
 if(actor.environment!=='development'||!actor.permissions.includes('config.write'))throw Error('需要开发配置权限');
 const report=await database.transaction(async tx=>{
  const [set]=await tx.select().from(configSets).where(eq(configSets.code,'v1_0')).for('update');if(!set)throw Error('缺少v1_0配置集');
  const [loopRow]=await tx.select().from(gameParameters).where(and(eq(gameParameters.configSetId,set.id),eq(gameParameters.code,'map01_loop')));
  const loop=map01LoopSchema.parse(loopRow?.jsonValue);
  const reverse=Object.fromEntries(Object.entries(loop.encounterBindings).map(([code,id])=>[id,code]));
  const allReferences=encounterReferences(map);
  if(allReferences.length!==14||allReferences.some(id=>!loop.combat.encounters.some(e=>e.id===id)))throw Error('地图战斗引用不完整');
  const encounterRows=await tx.select().from(encounters).where(and(eq(encounters.configSetId,set.id),inArray(encounters.code,Object.keys(loop.encounterBindings))));
  if(encounterRows.length!==13)throw Error('缺少地图1正式遭遇设计');
  const existing=await readMapSource(tx,set.id,map.id);
  if(existing){
   if(canonical(existing.source)!==canonical(map)||canonical(existing.regions)!==canonical(regionDocument))throw Error('地图或后台已有修改，停止自动覆盖');
   const intended=map.objects.filter(o=>o.encounterId).map(o=>({objectId:o.id,encounterId:encounterRows.find(e=>e.code===reverse[o.encounterId!])?.id}));
   if(canonical(existing.bindings)!==canonical(intended))throw Error('地图遭遇关联有差异，停止覆盖');
   return {configSet:set.code,revision:set.currentRevision,changed:0};
  }
  const [old]=await tx.select().from(mapDefinitions).where(and(eq(mapDefinitions.configSetId,set.id),eq(mapDefinitions.code,map.id)));
  if(old)throw Error('已有旧地图定义，必须单独审核迁移');
  const conflicting=await tx.select({code:mapObjectPrototypes.code}).from(mapObjectPrototypes).where(and(eq(mapObjectPrototypes.configSetId,set.id),inArray(mapObjectPrototypes.code,map.objects.map(o=>o.id))));if(conflicting.length)throw Error('对象原型编码已存在，停止覆盖');
  const requestId=uuid();let changed=0;
  async function audit(type:string,id:string,code:string,after:unknown){await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:type,entityId:id,entityCode:code,revision:1,operation:'create',afterData:after,requestId});await tx.insert(auditLogs).values({configSetId:set.id,entityType:type,entityId:id,action:'config.map01.source-import',requestId,details:{actorId:actor.id,code,sourceHash:hash(map)}});changed++;}
  const mapId=uuid();const mapRow={...header,status:'disabled',notes:'已导入Godot正式连续坐标地图，待文案、出征及远端适配验收后启用；保持原始交互与奖励'};
  await tx.insert(mapDefinitions).values({id:mapId,configSetId:set.id,...mapRow});await audit('map_definition',mapId,map.id,mapRow);
  for(const [sortOrder,object]of map.objects.entries()){
   const prototypeId=uuid();const encounterId=object.encounterId?encounterRows.find(e=>e.code===reverse[object.encounterId!])?.id:null;
   if(object.encounterId&&!encounterId)throw Error(`对象${object.id}缺少正式遭遇关联`);
   const prototype={code:object.id,kind:object.kind,title:object.title,description:object.description??null,refreshType:object.refreshType??'permanent',encounterId:encounterId??null,interactionConfig:without(object,['id','x','y','kind','title','description','refreshType']),sortOrder,status:'disabled',notes:'来自Godot地图1；交互条件、奖励、剧情状态原样保留'};
   await tx.insert(mapObjectPrototypes).values({id:prototypeId,configSetId:set.id,...prototype});await audit('map_object_prototype',prototypeId,object.id,prototype);
   const placementId=uuid();const placement={mapId,prototypeId,instanceCode:object.id,x:object.x,y:object.y,overrideConfig:{sourceKeys:Object.keys(object)}};
   await tx.insert(mapObjectPlacements).values({id:placementId,...placement});await audit('map_object_placement',placementId,object.id,placement);
  }
  const restored=await readMapSource(tx,set.id,map.id);
  if(!restored||canonical(restored.source)!==canonical(map)||canonical(restored.regions)!==canonical(regionDocument))throw Error('数据库往返校验失败，全部回滚');
  await tx.update(configSets).set({currentRevision:sql`${configSets.currentRevision}+1`}).where(eq(configSets.id,set.id));
  await tx.update(configChangeRequests).set({status:'superseded'}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,['draft','submitted','approved'])));
  return {configSet:set.code,revision:set.currentRevision+1,changed};
 });
 const result={...report,mapCode:map.id,objects:map.objects.length,directBattleBindings:13,totalEncounterReferences:14,kinds:Object.fromEntries([...new Set(map.objects.map(o=>o.kind))].map(kind=>[kind,map.objects.filter(o=>o.kind===kind).length])),worldSize:map.worldSize,entry:map.spawn,sourceHash:hash(map),regionsHash:hash(regionDocument),regionLayers:regionDocument.annotations.layers.map(l=>({id:l.id,count:l.shapes.length})),status:'disabled',published:false,roundTripVerified:true};
 if(report.changed)await writeFile('Docs/29_地图1导入结果.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1}).finally(()=>databasePool.end());
