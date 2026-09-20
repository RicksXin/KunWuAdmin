import 'dotenv/config';
import {writeFile,readFile} from 'node:fs/promises';
import {eq,inArray} from 'drizzle-orm';
import {database,databasePool} from '../server/db/client';
import {configSets,enemies,skills,enemySkills} from '../db/schema';
async function main(){
 const [set]=await database.select().from(configSets).where(eq(configSets.code,'v1_0'));
 const enemyRows=(await database.select().from(enemies).where(eq(enemies.configSetId,set.id))).filter(e=>e.runtime);
 const skillRows=(await database.select().from(skills).where(eq(skills.configSetId,set.id))).filter(s=>s.enemyRuntime);
 const bindings=await database.select().from(enemySkills).where(inArray(enemySkills.enemyId,enemyRows.map(e=>e.id))).orderBy(enemySkills.slotIndex);
 const source=JSON.parse(await readFile('../KunWuGodot/data/config/combat_map01_formal.json','utf8'));
 const payload={skills:skillRows.map(({code,nameKey,damageKind,targetType,baseIntervalTicks,cooldownTicks,primaryAttribute,primaryPercent,secondaryAttribute,secondaryPercent,enemyRuntime})=>({code,nameKey,damageKind,targetType,baseIntervalTicks,cooldownTicks,primaryAttribute,primaryPercent,secondaryAttribute,secondaryPercent,enemyRuntime})),enemies:enemyRows.map(e=>({code:e.code,maxHp:e.maxHp,nameKey:e.nameKey,strength:e.strength,magic:e.magic,technique:e.technique,speed:e.speed,constitution:e.constitution,armor:e.armor,resistance:e.resistance,runtime:e.runtime,skills:bindings.filter(b=>b.enemyId===e.id).map(b=>({skillCode:skillRows.find(s=>s.id===b.skillId)!.code}))})),encounters:source.encounters.map((e:{id:string;members:{enemyId:string;quantity:number}[];escapeEnemyHpPercent:number})=>({code:e.id,escapeEnemyHpPercent:e.escapeEnemyHpPercent,firstClearRewardPackCode:'first',repeatRewardPackCode:'repeat',members:e.members.map(m=>({enemyCode:m.enemyId==='m1_gate_spirit'?'b1_gate_stone':m.enemyId,quantity:m.quantity,initialActionTimer:0}))})),parameters:[]};
 await writeFile('../KunWuGodot/tools/fixtures/map01-admin-runtime.json',JSON.stringify(payload,null,2)+'\n');console.log(`Exported DB revision ${set.currentRevision}: ${enemyRows.length} enemies, ${skillRows.length} skills; test-only encounters/reward references`);
}
main().finally(()=>databasePool.end());
