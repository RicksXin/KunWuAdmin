import 'dotenv/config';
import {readFile,writeFile} from 'node:fs/promises';
import {and,eq,inArray,sql} from 'drizzle-orm';
import {v7 as uuid} from 'uuid';
import {database,databasePool} from '../server/db/client';
import {configSets,expeditionRules,expeditionItemRules,foodRestRules,mapExpeditionRules,mapDefinitions,gameAssets,itemDefinitions,i18nTexts,configEntityRevisions,configChangeRequests,auditLogs} from '../db/schema';
import {ResourceService} from '../server/services/resource-service';
import {canonical} from '../server/domain/maps/source';
async function main(){
 const e=JSON.parse(await readFile('../KunWuGodot/data/config/expedition_preparation.json','utf8')).expedition_preparation;
 const local=JSON.parse(await readFile('.local/resource-development.json','utf8'));
 const actor=await new ResourceService(databasePool).authenticate(local.adminToken,'admin');if(actor.environment!=='development'||!actor.permissions.includes('config.write'))throw Error('需要开发配置权限');
 const report=await database.transaction(async tx=>{
  const [set]=await tx.select().from(configSets).where(eq(configSets.code,'v1_0')).for('update');if(!set)throw Error('缺少v1_0');
  const [map]=await tx.select().from(mapDefinitions).where(and(eq(mapDefinitions.configSetId,set.id),eq(mapDefinitions.code,'map_01')));if(!map)throw Error('地图未导入');
  const requestId=uuid();let changed=0;
  async function audit(type:string,id:string,code:string,after:unknown){await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:type,entityId:id,entityCode:code,revision:1,operation:'create',afterData:after,requestId});await tx.insert(auditLogs).values({configSetId:set.id,entityType:type,entityId:id,action:'config.expedition.import',requestId,details:{actorId:actor.id,code}});changed++;}
  let assets=await tx.select().from(gameAssets).where(eq(gameAssets.configSetId,set.id));
  if(!assets.some(a=>a.code==='beast_meat')){const id=uuid();const row={code:'beast_meat',nameKey:'item.beast_meat',assetType:'item',storageKind:'inventory',weight:2,stackLimit:999,status:'active',isTradeable:false};await tx.insert(gameAssets).values({id,configSetId:set.id,...row});await tx.insert(itemDefinitions).values({configSetId:set.id,assetId:id,code:'beast_meat',name:'兽肉',category:'food',usageTag:'food',status:'active',details:{source:'现有Godot出征配置',weight:2,description:'休整时食用，恢复8灵粮'}});await tx.insert(i18nTexts).values({configSetId:set.id,code:'item.beast_meat',locale:'zh-CN',text:'兽肉'});await audit('item',id,'beast_meat',row);assets=await tx.select().from(gameAssets).where(eq(gameAssets.configSetId,set.id));}
  const assetId=(code:string)=>{const a=assets.find(a=>a.code===code&&a.status==='active');if(!a)throw Error(`缺少启用资产${code}`);return a.id;};
  const rule={code:'default',staminaMax:e.staminaMax,staminaRecoveryAmount:e.staminaRecoveryAmount,staminaRecoveryIntervalSeconds:e.staminaRecoveryIntervalSeconds,baseBurden:e.baseBurden,strengthBurdenFactor:e.strengthBurdenFactor,constitutionBurdenFactor:e.constitutionBurdenFactor,maxPartyPresets:e.maxPartyPresets,partyUnlockCosts:e.partyUnlockCosts,baseRestCount:e.field.restUseLimitsByForgeLevel[0],fieldHealingPercent:e.field.healingPercent,grainDepletionStepLimit:e.field.grainDepletionStepLimit,defaultLootWeight:e.field.defaultLootWeight,materialLossBasisPoints:3000,equipmentLossBasisPoints:3000,returnTalismanAssetId:assetId(e.field.returnTalismanItemId)};
  const [old]=await tx.select().from(expeditionRules).where(eq(expeditionRules.configSetId,set.id));
  if(old){
   // 策划36覆盖旧客户端25%；仅允许这一已知旧值迁移，其他人工修改仍拒绝覆盖。
   const healingMigration=old.fieldHealingPercent===25&&rule.fieldHealingPercent===35;
   for(const [k,v]of Object.entries(rule))if(!(healingMigration&&k==='fieldHealingPercent')&&canonical(old[k as keyof typeof old])!==canonical(v))throw Error(`出征规则${k}已修改，停止覆盖`);
   if(healingMigration){
    await tx.update(expeditionRules).set({fieldHealingPercent:35}).where(eq(expeditionRules.id,old.id));
    await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:'expedition_rule',entityId:old.id,entityCode:'default',revision:2,operation:'update',beforeData:old,afterData:{...old,fieldHealingPercent:35},requestId});
    await tx.insert(auditLogs).values({configSetId:set.id,entityType:'expedition_rule',entityId:old.id,action:'config.expedition.healing-correction',requestId,details:{actorId:actor.id,source:'策划36：每次休整恢复35%最大生命，向下取整'}});changed++;
   }
  }else{const id=uuid();await tx.insert(expeditionRules).values({id,configSetId:set.id,...rule});await audit('expedition_rule',id,'default',rule);}
  const desiredItems=[...e.items,...e.field.foodItems.map((f:{itemId:string;weight:number})=>({id:f.itemId,weight:f.weight,food:true}))] as {id:string;weight:number;food?:boolean}[];
  for(const [sortOrder,item]of desiredItems.entries()){
   const row={assetId:assetId(item.id),weightOverride:item.weight,consumeTiming:item.id==='spiritGrain'?'per_step':'manual',sortOrder,parameterJson:{foodOnly:item.food??false}};
   const [prior]=await tx.select().from(expeditionItemRules).where(and(eq(expeditionItemRules.configSetId,set.id),eq(expeditionItemRules.assetId,row.assetId)));
   if(prior){for(const [k,v]of Object.entries(row))if(canonical(prior[k as keyof typeof prior])!==canonical(v))throw Error(`出征物品${item.id}已有修改`);}else{const id=uuid();await tx.insert(expeditionItemRules).values({id,configSetId:set.id,...row});await audit('expedition_item_rule',id,item.id,row);}
  }
  for(const [sortOrder,food]of e.field.foodItems.entries()){
   const row={assetId:assetId(food.itemId),grainRestored:food.grainRestored,sortOrder};const [prior]=await tx.select().from(foodRestRules).where(and(eq(foodRestRules.configSetId,set.id),eq(foodRestRules.assetId,row.assetId)));
   if(prior){if(prior.grainRestored!==row.grainRestored)throw Error('食物恢复已修改');}else{const id=uuid();await tx.insert(foodRestRules).values({id,configSetId:set.id,...row});await audit('food_rest_rule',id,food.itemId,row);}
  }
  const m=e.maps.find((m:{mapId:string})=>m.mapId==='map_01');const mapRule={mapId:map.id,staminaCost:m.staminaCost,grainPerStep:m.grainPerStep,minimumCarriedGrain:m.minimumCarriedGrain};const [priorMapRule]=await tx.select().from(mapExpeditionRules).where(eq(mapExpeditionRules.mapId,map.id));
  if(priorMapRule){for(const [k,v]of Object.entries(mapRule))if(priorMapRule[k as keyof typeof priorMapRule]!==v)throw Error('地图出征费用已修改');}else{const id=uuid();await tx.insert(mapExpeditionRules).values({id,...mapRule});await audit('map_expedition_rule',id,'map_01',mapRule);}
  if(changed){await tx.update(configSets).set({currentRevision:sql`${configSets.currentRevision}+1`}).where(eq(configSets.id,set.id));await tx.update(configChangeRequests).set({status:'superseded'}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,['draft','submitted','approved'])));}
  return {revision:set.currentRevision+(changed?1:0),changed,staminaCost:m.staminaCost,minimumCarriedGrain:m.minimumCarriedGrain,lossBasisPoints:3000,fieldHealingPercent:rule.fieldHealingPercent,healingSource:"策划36_营地后勤与野外循环机制",published:false};
 });
 if(report.changed)await writeFile('Docs/30_出征规则同步结果.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1}).finally(()=>databasePool.end());
