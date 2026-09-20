import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { v7 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { database,databasePool } from "../../server/db/client";
import { configSets,skills,auditLogs,configEntityRevisions,configChangeRequests } from "../../db/schema";
import { getSkill,updateSkill,skillUpdateSchema } from "../../server/services/config-skill";
import { skillContent } from "../../server/domain/skills/content-v1";
import { compileConfigModules } from "../../server/compiler/config-compiler";

test("技能编辑保留精通效果，拒绝清空和并发旧修订；编译保留召唤契约",async()=>{
  const id=uuid(),code=`test_skill_${id.replaceAll("-","")}`;
  try{
    await database.insert(configSets).values({id,code,name:"技能自动化测试",currentRevision:1});
    const definition=skillContent.find(s=>s.code==="skill_myriad_puppet")!;
    const {name,...data}=definition;
    await database.insert(skills).values({...data,configSetId:id,nameKey:name});
    await database.insert(configChangeRequests).values({configSetId:id,sourceRevision:1,title:"技能测试变更",status:"approved"});
    const before=(await getSkill(code,definition.code)).skill;
    const input=skillUpdateSchema.parse({...before,baseIntervalTicks:35});
    delete input.mechanics; // Older clients must not accidentally erase the new fields.
    const result=await updateSkill(code,definition.code,input,uuid(),"skill-test");
    assert.deepEqual(result.skill.mechanics,definition.mechanics);
    assert.equal(result.skill.revision,2);assert.equal(result.configSetRevision,2);
    await assert.rejects(()=>updateSkill(code,definition.code,input,uuid()),/revision has changed/);
    await assert.rejects(()=>updateSkill(code,definition.code,{...input,revision:2,mechanics:null},uuid()),/不能清空/);
    const after=(await getSkill(code,definition.code)).skill;
    assert.equal(after.revision,2);
    const requests=await database.select().from(configChangeRequests).where(eq(configChangeRequests.configSetId,id));
    assert.equal(requests[0].status,"superseded");
    const snapshots=await database.select().from(configEntityRevisions).where(eq(configEntityRevisions.configSetId,id));
    assert.equal(snapshots.length,1);
    const audit=await database.select().from(auditLogs).where(eq(auditLogs.configSetId,id));assert.equal(audit.length,1);
    const compiled=await compileConfigModules(database,id,1,2);
    const combat=compiled.find(m=>m.moduleCode==="combat")!.payload as {skillConfigVersion:number;skillRuntimeEnabled:boolean;skills:Array<{code:string;mechanics:typeof definition.mechanics}>};
    assert.equal(combat.skillConfigVersion,2);assert.equal(combat.skillRuntimeEnabled,false);
    assert.deepEqual(combat.skills[0].mechanics,definition.mechanics);
    assert.equal(combat.skills[0].code,definition.code);
  }finally{
    for(const table of [skills,auditLogs,configEntityRevisions,configChangeRequests])await database.delete(table).where(eq(table.configSetId,id));
    await database.delete(configSets).where(eq(configSets.id,id));
    await databasePool.end();
  }
});
