import "dotenv/config";
import {map01BossEquipmentRewards} from "../server/domain/encounters/map01-rewards";
import {readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {and,eq,inArray,sql} from "drizzle-orm";
import {v7 as uuid} from "uuid";
import {database,databasePool} from "../server/db/client";
import {ResourceService} from "../server/services/resource-service";
import {configSets,gameParameters,skills,enemies,enemySkills,i18nTexts,configEntityRevisions,auditLogs,configChangeRequests} from "../db/schema";
import {enemyRuntimeSchema,enemySkillRuntimeSchema} from "../server/domain/encounters/runtime";
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
async function main(){
 const source=await readFile('../KunWuGodot/data/config/combat_map01_formal.json','utf8');
 const content=JSON.parse(source);const sourceHash=createHash('sha256').update(source).digest('hex');
 const local=JSON.parse(await readFile('.local/resource-development.json','utf8'));
 const actor=await new ResourceService(databasePool).authenticate(local.adminToken,'admin');
 if(actor.environment!=='development'||!actor.permissions.includes('config.write'))throw Error('需要开发配置权限');
 const result=await database.transaction(async tx=>{
  const [set]=await tx.select().from(configSets).where(eq(configSets.code,'v1_0')).for('update');if(!set)throw Error('缺少v1_0');
  const requestId=uuid();let changed=0;const skillIds=new Map<string,string>();
  async function audit(type:string,id:string,code:string,revision:number,before:unknown,after:unknown){
   await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:type,entityId:id,entityCode:code,revision,operation:before?'update':'create',beforeData:before,afterData:after,requestId});
   await tx.insert(auditLogs).values({configSetId:set.id,entityType:type,entityId:id,action:`config.${type}.map01-runtime`,requestId,details:{actorId:actor.id,sourceHash,code}});changed++;
  }
  for(const skill of content.skills){
   const enemyRuntime=enemySkillRuntimeSchema.parse({version:1,...(skill.appliesStatus?{appliesStatus:skill.appliesStatus}:{}),...(skill.useBelowHpPercent!==undefined?{useBelowHpPercent:skill.useBelowHpPercent}:{}),...(skill.id==='m1_boss_ground_quake'?{warningTicks:16}:{})});
   const values={code:skill.id,nameKey:`skill.${skill.id}.name`,damageKind:skill.damageKind,targetType:skill.targetType,baseIntervalTicks:skill.baseIntervalTicks,cooldownTicks:skill.cooldownTicks,castTicks:0,ignoreTaunt:skill.targetType==='ENEMY_ALL',primaryAttribute:skill.primaryAttribute,primaryPercent:skill.primaryPercent,secondaryAttribute:skill.secondaryAttribute??null,secondaryPercent:skill.secondaryPercent??0,enemyRuntime,status:'active',notes:'地图1敌人技能；来源19分册及现有Godot执行参数。非玩家技能。'};
   const [old]=await tx.select().from(skills).where(and(eq(skills.configSetId,set.id),eq(skills.code,skill.id)));
   if(old){for(const [k,v]of Object.entries(values))if(canonical(old[k as keyof typeof old])!==canonical(v))throw Error(`${skill.id}.${k} 有修改，停止覆盖`);skillIds.set(skill.id,old.id);continue;}
   const id=uuid();await tx.insert(skills).values({id,configSetId:set.id,...values});skillIds.set(skill.id,id);
   const [text]=await tx.select().from(i18nTexts).where(and(eq(i18nTexts.configSetId,set.id),eq(i18nTexts.code,values.nameKey),eq(i18nTexts.locale,'zh-CN')));
   if(text&&text.text!==skill.name)throw Error('名称冲突');if(!text)await tx.insert(i18nTexts).values({configSetId:set.id,code:values.nameKey,locale:'zh-CN',text:skill.name});
   await audit('skill',id,skill.id,1,null,values);
  }
  for(const template of content.enemyTemplates){
   const code=template.id==='m1_gate_spirit'?'b1_gate_stone':template.id;
   const [old]=await tx.select().from(enemies).where(and(eq(enemies.configSetId,set.id),eq(enemies.code,code)));if(!old)throw Error(`缺少敌人${code}`);
   if(old.maxHp!==template.maxHp||Object.entries(template.attributes).some(([k,v])=>old[k as keyof typeof old]!==v))throw Error(`${code} 数值与来源冲突`);
   const runtime=enemyRuntimeSchema.parse({version:1,initialActionTimer:template.initialActionTimer,...template.mechanics,...(code==='b1_gate_stone'?{controlImmunities:['root'],stunDurationPercents:[100,60,30],lowPhase:{hpPercent:35,skillCode:'m1_boss_ground_quake',intervalPercent:80}}:{})});
   const desired=template.skillIds.map((code:string,slotIndex:number)=>({skillId:skillIds.get(code)!,slotIndex,initialCooldownTicks:0}));
   const rows=await tx.select().from(enemySkills).where(eq(enemySkills.enemyId,old.id)).orderBy(enemySkills.slotIndex);
   if(rows.length&&canonical(rows.map(({skillId,slotIndex,initialCooldownTicks})=>({skillId,slotIndex,initialCooldownTicks})))!==canonical(desired))throw Error(`${code} 技能绑定已修改`);
   if(old.runtime){if(canonical(old.runtime)!==canonical(runtime))throw Error(`${code} 执行规则已修改`);if(!rows.length)throw Error(`${code} 技能绑定丢失`);continue;}
   await tx.update(enemies).set({runtime,revision:old.revision+1}).where(eq(enemies.id,old.id));
   if(!rows.length)await tx.insert(enemySkills).values(desired.map((r:{skillId:string;slotIndex:number;initialCooldownTicks:number})=>({...r,enemyId:old.id})));
   await audit('enemy',old.id,code,old.revision+1,old,{...old,runtime,skills:desired,revision:old.revision+1});
  }
  const rewardCode='map01_boss_equipment_rewards';
  const rewardPlan=map01BossEquipmentRewards;
  const [oldPlan]=await tx.select().from(gameParameters).where(and(eq(gameParameters.configSetId,set.id),eq(gameParameters.code,rewardCode)));
  if(oldPlan&&canonical(oldPlan.jsonValue)!==canonical(rewardPlan))throw Error('Boss奖励规则已有修改，停止覆盖');
  if(!oldPlan){const id=uuid();const row={code:rewardCode,valueType:'json',jsonValue:rewardPlan,status:'active',notes:'已确认的奖励规格；尚待装备实例生成器，不作为可直接发放的两件成品'};await tx.insert(gameParameters).values({id,configSetId:set.id,...row});await audit('game_parameter',id,rewardCode,1,null,row);}
  if(changed){await tx.update(configSets).set({currentRevision:sql`${configSets.currentRevision}+1`}).where(eq(configSets.id,set.id));await tx.update(configChangeRequests).set({status:'superseded'}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,['draft','submitted','approved'])));}
  return {configSet:'v1_0',revision:set.currentRevision+(changed?1:0),changed,sourceHash,skills:content.skills.length,enemies:content.enemyTemplates.length,status:'执行字段已入库，敌人仍停用，待遭遇与奖励一起验收'};
 });
 if(result.changed)await writeFile('Docs/23_地图1执行同步结果.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1}).finally(()=>databasePool.end());
