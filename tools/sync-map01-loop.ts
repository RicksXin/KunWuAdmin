import {map01BossEquipmentRewards} from '../server/domain/encounters/map01-rewards';
import 'dotenv/config';
import {hydrateMap01Loop} from '../server/services/map01-loop';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {and,eq,inArray,sql} from 'drizzle-orm';
import {v7 as uuid} from 'uuid';
import {database,databasePool} from '../server/db/client';
import {ResourceService} from '../server/services/resource-service';
import {configSets,gameParameters,auditLogs,configEntityRevisions,configChangeRequests,gameAssets,i18nTexts,itemDefinitions} from '../db/schema';
import {map01LoopSchema} from '../server/domain/encounters/loop';
import source from '../server/domain/encounters/map01-loop.json';
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
async function main(){
 const payload=map01LoopSchema.parse(source);
 const local=JSON.parse(await readFile('.local/resource-development.json','utf8'));
 const actor=await new ResourceService(databasePool).authenticate(local.adminToken,'admin');
 if(actor.environment!=='development'||!actor.permissions.includes('config.write'))throw Error('需要开发配置权限');
 const result=await database.transaction(async tx=>{
  const [set]=await tx.select().from(configSets).where(eq(configSets.code,'v1_0')).for('update');if(!set)throw Error('缺少v1_0');
  let changed=0;const requestId=uuid();
  async function audit(type:string,id:string,code:string,revision:number,after:unknown){await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:type,entityId:id,entityCode:code,revision,operation:'create',afterData:after,requestId});await tx.insert(auditLogs).values({configSetId:set.id,entityType:type,entityId:id,action:`config.${type}.map01-loop`,requestId,details:{actorId:actor.id,code}});changed++;}
  const code='map01_loop';const [old]=await tx.select().from(gameParameters).where(and(eq(gameParameters.configSetId,set.id),eq(gameParameters.code,code)));
  if(old&&canonical(old.jsonValue)!==canonical(payload))throw Error('地图1执行配置已修改，请审核差异后更新，停止覆盖');
  if(!old){const id=uuid();const row={code,valueType:'json',jsonValue:payload,status:'active',notes:'地图1绑定、装备实例、奖励与结算运行配置；尚未整版发布'};await tx.insert(gameParameters).values({id,configSetId:set.id,...row});await audit('game_parameter',id,code,1,row);}
  const [rewardPlan]=await tx.select().from(gameParameters).where(and(eq(gameParameters.configSetId,set.id),eq(gameParameters.code,'map01_boss_equipment_rewards')));
  if(rewardPlan&&canonical(rewardPlan.jsonValue)!==canonical(map01BossEquipmentRewards)){
   const prior={...map01BossEquipmentRewards,implementationStatus:'pending_equipment_generation'};
   if(canonical(rewardPlan.jsonValue)!==canonical(prior))throw Error('Boss奖励规格已修改，停止覆盖');
   const next={...rewardPlan,jsonValue:map01BossEquipmentRewards,revision:rewardPlan.revision+1,notes:'地图1装备实例开发环境已验证；渠道尚未发布'};
   await tx.update(gameParameters).set({jsonValue:next.jsonValue,revision:next.revision,notes:next.notes}).where(eq(gameParameters.id,rewardPlan.id));
   await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:'game_parameter',entityId:rewardPlan.id,entityCode:rewardPlan.code,revision:next.revision,operation:'update',beforeData:rewardPlan,afterData:next,requestId});
   await tx.insert(auditLogs).values({configSetId:set.id,entityType:'game_parameter',entityId:rewardPlan.id,action:'config.game_parameter.map01-loop',requestId,details:{actorId:actor.id,code:rewardPlan.code}});changed++;
  }
  const items=new Map<string,{name:string;protected:boolean}>();
  for(const encounter of payload.combat.encounters)for(const item of [...encounter.loot,...(encounter.firstLoot??[])])items.set(item.itemId,{name:item.name??item.itemId,protected:payload.settlement.protectedItemCodes.includes(item.itemId)});
  for(const [code,item]of items){
   const [old]=await tx.select().from(gameAssets).where(and(eq(gameAssets.configSetId,set.id),eq(gameAssets.code,code)));if(old){if(old.status!=='active')throw Error(`奖励资产${code}未启用`);continue;}
   const id=uuid(),nameKey=`item.${code}.name`,category=item.protected?'quest':'material';
   const row={code,assetType:'item',nameKey,status:'active',stackLimit:999,weight:1,storageKind:'inventory',isProtected:item.protected,isDiscardable:!item.protected,isTradeable:false};
   await tx.insert(gameAssets).values({id,configSetId:set.id,...row});
   await tx.insert(i18nTexts).values({configSetId:set.id,code:nameKey,locale:'zh-CN',text:item.name});
   await tx.insert(itemDefinitions).values({configSetId:set.id,assetId:id,code,name:item.name,category,usageTag:category,status:'active',details:{source:'19分册/正式地图1奖励',description:'地图1战斗材料或关键物',contentStatus:'ready',weight:1}});
   await audit('item',id,code,1,row);
  }
  if(changed){await tx.update(configSets).set({currentRevision:sql`${configSets.currentRevision}+1`}).where(eq(configSets.id,set.id));await tx.update(configChangeRequests).set({status:'superseded'}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,['draft','submitted','approved'])));}
  return {expanded:await hydrateMap01Loop(tx,set.id,payload,true),revision:set.currentRevision+(changed?1:0),changed,hash:createHash('sha256').update(canonical(payload)).digest('hex')};
 });
 // This is an embedded development snapshot, not a channel publication.
 await writeFile('../KunWuGodot/data/config/map01_loop.json',JSON.stringify(result.expanded,null,2)+'\n');
 await writeFile('../KunWuGodot/data/config/combat_map01_formal.json',JSON.stringify(result.expanded.combat,null,2)+'\n');
 const {expanded: _expanded,...report}=result;void _expanded;
 await writeFile('Docs/25_地图1遭遇闭环同步结果.json',JSON.stringify({...report,bindings:13,encounters:14,equipmentTemplates:6,published:false},null,2)+'\n');
 console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1}).finally(()=>databasePool.end());
