import 'dotenv/config';
import {writeFile,readFile} from 'node:fs/promises';
import {and,eq,inArray,sql} from 'drizzle-orm';
import {v7 as uuid} from 'uuid';
import {database,databasePool} from '../server/db/client';
import {configSets,enemies,encounters,encounterMembers,mapDefinitions,mapObjectPrototypes,mapObjectPlacements,gameParameters,i18nTexts,configEntityRevisions,configChangeRequests,auditLogs} from '../db/schema';
import {map01LoopSchema} from '../server/domain/encounters/loop';
import {compileConfigModules} from '../server/compiler/config-compiler';
import {ResourceService} from '../server/services/resource-service';
const rollback=new Error('CANDIDATE_ONLY');
async function main(){
 const apply=process.argv.includes('--apply');
 const local=JSON.parse(await readFile('.local/resource-development.json','utf8'));
 const actor=await new ResourceService(databasePool).authenticate(local.adminToken,'admin');if(actor.environment!=='development'||!actor.permissions.includes('config.write'))throw Error('需要开发配置权限');
 let payload:Record<string,unknown>={},report:Record<string,unknown>={};
 try{await database.transaction(async tx=>{
  const [set]=await tx.select().from(configSets).where(eq(configSets.code,'v1_0')).for('update');if(!set)throw Error('缺少v1_0');
  const [parameter]=await tx.select().from(gameParameters).where(and(eq(gameParameters.configSetId,set.id),eq(gameParameters.code,'map01_loop')));const loop=map01LoopSchema.parse(parameter?.jsonValue);
  const nameRows=await tx.select({key:i18nTexts.code,text:i18nTexts.text}).from(i18nTexts).where(and(eq(i18nTexts.configSetId,set.id),eq(i18nTexts.locale,"zh-CN")));const names=new Map(nameRows.map(n=>[n.key,n.text]));
  const requestId=uuid();let changed=0;
  async function audit(type:string,id:string,code:string,revision:number,before:unknown,after:unknown){await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:type,entityId:id,entityCode:code,revision,operation:'update',beforeData:before,afterData:after,requestId});await tx.insert(auditLogs).values({configSetId:set.id,entityType:type,entityId:id,action:'config.map01.runtime-ready',requestId,details:{actorId:actor.id,code}});changed++;}
  const enemyRows=await tx.select().from(enemies).where(and(eq(enemies.configSetId,set.id),inArray(enemies.code,loop.combat.enemyTemplates.map(e=>String(e.id)))));
  if(enemyRows.length!==8)throw Error('地图1敌人不完整');
  for(const old of enemyRows){if(!old.runtime||!old.design)throw Error(`${old.code}缺少执行配置`);if(old.status==='active'&&old.design.implementationStatus==='runtime_ready')continue;const next={status:'active',revision:old.revision+1,design:{...old.design,implementationStatus:'runtime_ready' as const},notes:'地图1执行参数与场景回归通过；仅在审核发布后下发'};await tx.update(enemies).set(next).where(eq(enemies.id,old.id));await audit('enemy',old.id,old.code,next.revision,old,next);}
  const rows=await tx.select().from(encounters).where(and(eq(encounters.configSetId,set.id),inArray(encounters.code,Object.keys(loop.encounterBindings))));if(rows.length!==13)throw Error('地图1遭遇不完整');
  for(const old of rows){const runtime=loop.combat.encounters.find(e=>e.id===loop.encounterBindings[old.code])!;if(!old.design)throw Error('缺少遭遇设计');const members=await tx.select().from(encounterMembers).where(eq(encounterMembers.encounterId,old.id)).orderBy(encounterMembers.memberIndex);const actual=members.map(m=>({enemyId:enemyRows.find(e=>e.id===m.enemyId)?.code,quantity:m.quantity}));if(JSON.stringify(actual)!==JSON.stringify(runtime.members))throw Error(`${old.code}编组与运行包不一致`);if(old.status==='active'&&old.design.implementationStatus==='runtime_ready')continue;const next={status:'active',revision:old.revision+1,design:{...old.design,implementationStatus:'runtime_ready' as const,rewardState:'runtime_package' as const,coordinateStatus:'bound' as const},notes:'入口绑定与奖励由map01_loop统一提供，保留首杀幂等'};await tx.update(encounters).set(next).where(eq(encounters.id,old.id));await audit('encounter',old.id,old.code,next.revision,old,next);}
  const [map]=await tx.select().from(mapDefinitions).where(and(eq(mapDefinitions.configSetId,set.id),eq(mapDefinitions.code,'map_01')));if(!map?.runtimeDocument)throw Error('未导入连续坐标地图');
  const placements=await tx.select().from(mapObjectPlacements).where(eq(mapObjectPlacements.mapId,map.id));if(placements.length!==31)throw Error('地图对象不完整');
  const prototypes=await tx.select().from(mapObjectPrototypes).where(inArray(mapObjectPrototypes.id,placements.map(p=>p.prototypeId)));
  for(const old of prototypes){if(old.status==='active')continue;const runtime=loop.combat.encounters.find(e=>e.id===old.code);const encounter=rows.find(e=>e.id===old.encounterId);const composition=runtime?.members.map(m=>`${names.get(`enemy.${m.enemyId}.name`)??m.enemyId} ×${m.quantity}`).join('、');const next={status:'active',revision:old.revision+1,...(composition?{title:names.get(encounter?.nameKey??'')??old.title,description:`当前敌群：${composition}。`,interactionConfig:{...(old.interactionConfig as Record<string,unknown>),inspectionText:`${composition}。技能和机制以敌人配置为准。`}}:{})};await tx.update(mapObjectPrototypes).set(next).where(eq(mapObjectPrototypes.id,old.id));await audit('map_object_prototype',old.id,old.code,next.revision,old,next);}
  if(map.status!=='active'){const next={status:'active',revision:map.revision+1,notes:'地图1连续坐标、远端区域、出征和奖励已联调；待统一审核发布'};await tx.update(mapDefinitions).set(next).where(eq(mapDefinitions.id,map.id));await audit('map_definition',map.id,map.code,next.revision,map,next);}
  if(changed){await tx.update(configSets).set({currentRevision:sql`${configSets.currentRevision}+1`}).where(eq(configSets.id,set.id));await tx.update(configChangeRequests).set({status:'superseded'}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,['draft','submitted','approved'])));}
  const modules=await compileConfigModules(tx as unknown as typeof database,set.id,set.schemaVersion,set.currentRevision+(changed?1:0));payload=Object.fromEntries(modules.map(m=>[m.moduleCode,m.payload]));report={revision:set.currentRevision+(changed?1:0),changed,applied:apply,published:false};
  if(!apply)throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 await writeFile('../KunWuGodot/tools/fixtures/map01-full-modules.json',JSON.stringify(payload,null,2)+'\n');
 if(apply)await writeFile('Docs/31_地图1启用结果.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1}).finally(()=>databasePool.end());
