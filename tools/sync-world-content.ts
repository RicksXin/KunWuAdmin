import "dotenv/config";
import {readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {and,eq,desc,inArray,sql} from "drizzle-orm";
import {v7 as uuid} from "uuid";
import {database,databasePool} from "../server/db/client";
import {ResourceService} from "../server/services/resource-service";
import {configSets,buildings,newPlayerPresets,gameParameters,resourceRuleReleases,resourceRuleDrafts,enemies,encounters,encounterMembers,i18nTexts,auditLogs,configEntityRevisions,configChangeRequests} from "../db/schema";
import {initialCamp,onboardingConfig} from "../server/domain/onboarding/config";
import {enemyDesignSchema,encounterDesignSchema,validateBattleDesign,type EnemyContent,type EncounterContent} from "../server/domain/encounters/config";
import {productionSourceCode,readProductionSource} from "../server/services/config-production";
import content from "../server/domain/encounters/content-v1.json";

const canonical=(value:unknown)=>JSON.stringify(value,(_k,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
async function main(){
  const enemyContent=content.enemies.map(e=>({...e,rank:e.rank as EnemyContent["rank"],design:enemyDesignSchema.parse(e.design)}));
  const encounterContent:EncounterContent[]=content.encounters.map(e=>({...e,design:encounterDesignSchema.parse(e.design)}));
  const errors=validateBattleDesign(enemyContent,encounterContent);if(errors.length)throw new Error(errors.join("；"));
  const source=await readFile("../KunWuGodot/Docs/1.0策划案/数值/19_1.0敌人与Boss战斗数值_草案.md","utf8");
  if(createHash("sha256").update(source).digest("hex")!==content.sourceHash)throw new Error("敌人来源已变化，需重新核对设计，停止导入");
  const local=JSON.parse(await readFile(".local/resource-development.json","utf8"));
  const actor=await new ResourceService(databasePool).authenticate(local.adminToken,"admin");
  if(actor.environment!=="development"||!actor.permissions.includes("config.write"))throw new Error("需要开发配置写权限");
  const result=await database.transaction(async tx=>{
    const [set]=await tx.select().from(configSets).where(eq(configSets.code,"v1_0")).for("update");if(!set)throw new Error("缺少v1_0");
    const requestId=uuid();let changed=0;
    async function audit(type:string,id:string,code:string,revision:number,before:unknown,after:unknown){
      await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:type,entityId:id,entityCode:code,revision,operation:before?"update":"create",beforeData:before,afterData:after,requestId});
      await tx.insert(auditLogs).values({configSetId:set.id,entityType:type,entityId:id,action:`config.${type}.sync`,requestId,details:{actorId:actor.id,code,source:"用户确认2026-09-18；19分册与28–31分册",sourceHash:content.sourceHash}});changed++;
    }
    async function name(key:string,text:string){
      const [old]=await tx.select().from(i18nTexts).where(and(eq(i18nTexts.configSetId,set.id),eq(i18nTexts.code,key),eq(i18nTexts.locale,"zh-CN")));
      if(old&&old.text!==text)throw new Error(`名称已改动：${key}`);
      if(!old)await tx.insert(i18nTexts).values({configSetId:set.id,code:key,locale:"zh-CN",text});
    }
    // Take a stable source pointer, not copied production values.
    await tx.select().from(resourceRuleDrafts).where(eq(resourceRuleDrafts.environment,"development")).for("share");
    const [release]=await tx.select().from(resourceRuleReleases).where(eq(resourceRuleReleases.environment,"development")).orderBy(desc(resourceRuleReleases.effectiveAt)).limit(1);
    if(!release)throw new Error("资源服务尚无已发布配置");
    const binding={environment:"development",releaseId:release.id,hash:release.hash};
    const [prior]=await tx.select().from(gameParameters).where(and(eq(gameParameters.configSetId,set.id),eq(gameParameters.code,productionSourceCode)));
    if(!prior||canonical(prior.jsonValue)!==canonical(binding)){
      const row={code:productionSourceCode,valueType:"json",jsonValue:binding,status:"active",revision:(prior?.revision??0)+1,notes:"引用资源管理已发布版本；不维护第二份生产规则"};
      const id=prior?.id??uuid();
      if(prior)await tx.update(gameParameters).set(row).where(eq(gameParameters.id,id));else await tx.insert(gameParameters).values({id,configSetId:set.id,...row});
      await audit("production_source",id,productionSourceCode,row.revision,prior??null,row);
    }
    await readProductionSource(tx,set.id);
    for(const [code,label] of [["yi_shi_dian","议事殿"],["ling_pu","灵源院"]]){
      const [old]=await tx.select().from(buildings).where(and(eq(buildings.configSetId,set.id),eq(buildings.code,code)));
      if(old)continue;
      const id=uuid(),nameKey=`building.${code}.name`;
      const row={code,nameKey,maxLevel:1,initialLevel:1,status:"active",unlockCondition:code==="yi_shi_dian"?{type:"initial"}:{type:"dialogue_complete",sceneCode:onboardingConfig.unlock.sceneCode,npcCode:onboardingConfig.unlock.npcCode,onceKey:onboardingConfig.unlock.onceKey}};
      await tx.insert(buildings).values({id,configSetId:set.id,...row});await name(nameKey,label);await audit("building",id,code,1,null,row);
    }
    const buildingRows=await tx.select().from(buildings).where(eq(buildings.configSetId,set.id));
    const payload={schemaVersion:2,onboardingRuntimeEnabled:false,onboarding:onboardingConfig,roster:[],wallet:{},inventory:{},camp:{...initialCamp(buildingRows.map(b=>b.code)),workerAssignments:{}},expeditionPreparation:{loadout:{},partyPresets:[]}};
    const [preset]=await tx.select().from(newPlayerPresets).where(and(eq(newPlayerPresets.configSetId,set.id),eq(newPlayerPresets.code,"v1_default")));
    if(preset&&canonical(preset.payload)!==canonical(payload))throw new Error("新档配置已有修改，请审核差异后更新，停止覆盖");
    if(!preset){
      const [other]=await tx.select().from(newPlayerPresets).where(and(eq(newPlayerPresets.configSetId,set.id),eq(newPlayerPresets.isDefault,true)));if(other)throw new Error("已存在其他默认新档预设");
      const id=uuid(),row={code:"v1_default",name:"1.0 新玩家：议事殿起步",isDefault:true,payload};await tx.insert(newPlayerPresets).values({id,configSetId:set.id,...row});await audit("new_player_preset",id,row.code,1,null,row);
    }
    const enemyIds=new Map<string,string>();
    for(const [sortOrder,e] of enemyContent.entries()){
      const [strength,magic,technique,speed,constitution,armor,resistance]=e.stats;
      const nameKey=`enemy.${e.code}.name`;
      const row={code:e.code,nameKey,raceKey:`enemy.${e.code}.race`,level:e.level,rank:e.rank,maxHp:e.maxHp,strength,magic,technique,speed,constitution,armor,resistance,design:e.design,status:"disabled",sortOrder,notes:"设计草稿；源数值已录入，技能/阶段与奖励尚未执行化，禁止直接启用"};
      const [old]=await tx.select().from(enemies).where(and(eq(enemies.configSetId,set.id),eq(enemies.code,e.code)));
      if(old){for(const [k,v] of Object.entries(row))if(canonical(old[k as keyof typeof old])!==canonical(v))throw new Error(`${e.code}.${k} 已改动，停止覆盖`);enemyIds.set(e.code,old.id);continue;}
      const id=uuid();enemyIds.set(e.code,id);await tx.insert(enemies).values({id,configSetId:set.id,...row});await name(nameKey,e.name);await audit("enemy",id,e.code,1,null,row);
    }
    for(const [sortOrder,e] of encounterContent.entries()){
      const nameKey=`encounter.${e.code}.name`;
      const type=["elite","boss"].includes(e.design.difficulty)?e.design.difficulty:"normal";
      const row={code:e.code,nameKey,encounterType:type,design:e.design,status:"disabled",sortOrder,escapeEnemyHpPercent:type==="boss"?[70,60,70,0][e.design.mapNumber-1]:0,notes:"未绑定正式地图坐标；奖励与敌人执行数据待接入，保持设计草稿"};
      const [old]=await tx.select().from(encounters).where(and(eq(encounters.configSetId,set.id),eq(encounters.code,e.code)));
      if(old){for(const [k,v] of Object.entries(row))if(canonical(old[k as keyof typeof old])!==canonical(v))throw new Error(`${e.code}.${k} 已改动，停止覆盖`);continue;}
      const id=uuid();await tx.insert(encounters).values({id,configSetId:set.id,...row});await name(nameKey,e.name);
      await tx.insert(encounterMembers).values(e.design.members.map((m,memberIndex)=>({encounterId:id,enemyId:enemyIds.get(m.enemyCode)!,memberIndex,quantity:m.quantity,initialActionTimer:0})));
      await audit("encounter",id,e.code,1,null,{...row,members:e.design.members});
    }
    if(changed){await tx.update(configSets).set({currentRevision:sql`${configSets.currentRevision}+1`}).where(eq(configSets.id,set.id));await tx.update(configChangeRequests).set({status:"superseded"}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,["draft","submitted","approved"])));}
    return {configSet:"v1_0",revision:set.currentRevision+(changed?1:0),changed,enemyDesigns:enemyContent.length,encounterDesigns:encounterContent.length,productionSource:binding,newPlayerPreset:"v1_default",runtimeStatus:"战斗设计未启用；新档剧情执行器未接入；生产沿用资源服务"};
  });
  if(result.changed)await writeFile("Docs/21_营地与战斗设计同步结果.json",JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;}).finally(()=>databasePool.end());
