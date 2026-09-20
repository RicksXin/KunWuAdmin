import 'server-only';
import {and,eq,inArray} from 'drizzle-orm';
import {database} from '../db/client';
import {enemies,skills,enemySkills,gameAssets} from '@/db/schema';
import {map01LoopSchema} from '../domain/encounters/loop';
import {enemyRuntimeSchema,enemySkillRuntimeSchema} from '../domain/encounters/runtime';
/** Expand the transport snapshot from the actual editable enemy and skill rows. */
export async function hydrateMap01Loop(db:Pick<typeof database,'select'>,setId:string,raw:unknown,allowDisabled=false){
 const value=map01LoopSchema.parse(raw);
 const protectedAssets=await db.select({code:gameAssets.code}).from(gameAssets).where(and(eq(gameAssets.configSetId,setId),eq(gameAssets.isProtected,true)));
 value.settlement.protectedItemCodes=[...new Set([...value.settlement.protectedItemCodes,...protectedAssets.map(a=>a.code)])];
 const codes=value.combat.enemyTemplates.map(e=>String(e.id));
 const rows=await db.select().from(enemies).where(and(eq(enemies.configSetId,setId),inArray(enemies.code,codes)));
 if(rows.length!==codes.length)throw Error('地图1敌人引用缺失');
 if(!allowDisabled&&rows.some(e=>e.status!=='active'))throw Error('地图1敌人尚未启用，不能发布执行包');
 const bindings=await db.select().from(enemySkills).where(inArray(enemySkills.enemyId,rows.map(e=>e.id))).orderBy(enemySkills.slotIndex);
 const skillRows=await db.select().from(skills).where(and(eq(skills.configSetId,setId),inArray(skills.id,bindings.map(b=>b.skillId))));
 if(skillRows.some(s=>s.status!=='active'))throw Error('地图1技能已停用');
 value.combat.enemyTemplates=value.combat.enemyTemplates.map(template=>{
  const row=rows.find(e=>e.code===template.id)!;const runtime=enemyRuntimeSchema.parse(row.runtime);
  const attributes={strength:row.strength,magic:row.magic,technique:row.technique,speed:row.speed,constitution:row.constitution,armor:row.armor,resistance:row.resistance};
  const skillIds=bindings.filter(b=>b.enemyId===row.id).map(b=>{const skill=skillRows.find(s=>s.id===b.skillId);if(!skill)throw Error('技能绑定缺失');return skill.code;});
  return {...template,level:row.level,maxHp:row.maxHp,attributes,initialActionTimer:runtime.initialActionTimer,mechanics:runtime,skillIds};
 });
 value.combat.skills=value.combat.skills.map(template=>{
  const row=skillRows.find(s=>s.code===template.id);if(!row)throw Error(`缺少地图1技能：${template.id}`);
  const runtime=enemySkillRuntimeSchema.parse(row.enemyRuntime);
  return {id:row.code,name:template.name,damageKind:row.damageKind,targetType:row.targetType,baseIntervalTicks:row.baseIntervalTicks,cooldownTicks:row.cooldownTicks,primaryAttribute:row.primaryAttribute,primaryPercent:row.primaryPercent,...(row.secondaryAttribute?{secondaryAttribute:row.secondaryAttribute,secondaryPercent:row.secondaryPercent}:{}),...runtime};
 });
 return map01LoopSchema.parse(value);
}
