import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { and,eq,inArray,sql } from "drizzle-orm";
import { v7 as uuid } from "uuid";
import { database,databasePool } from "../server/db/client";
import { ResourceService } from "../server/services/resource-service";
import { configSets,skills,careers,careerSkills,i18nTexts,auditLogs,configEntityRevisions,configChangeRequests } from "../db/schema";
import { skillContent,careerSkillContent } from "../server/domain/skills/content-v1";
import { readCultivators } from "../server/services/cultivator-config";
import { validateCultivators } from "../server/domain/cultivators/config";
import { validateSkillReferences } from "../server/domain/skills/config";

const canonical=(v:unknown):string=>JSON.stringify(v,(_key,value)=>value&&typeof value==="object"&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
async function main(){
  const contentErrors=validateSkillReferences(skillContent);
  if(contentErrors.length)throw new Error(contentErrors.join("；"));
  const local=JSON.parse(await readFile(".local/resource-development.json","utf8"));
  const actor=await new ResourceService(databasePool).authenticate(local.adminToken,"admin");
  if(actor.environment!=="development"||!actor.permissions.includes("config.write"))throw new Error("需要开发环境配置写入身份");
  const source=await readFile("tests/skills/fixtures/skills-v1.md","utf8");
  const upstream=await readFile("../KunWuGodot/Docs/1.0策划案/数值/17_1.0职业技能数值_草案.md","utf8");
  if(source!==upstream)throw new Error("技能来源文档已变化，请先核对差异、更新数据和来源验收，不自动覆盖");
  const sourceHash=createHash("sha256").update(source).digest("hex");
  const result=await database.transaction(async tx=>{
    const [set]=await tx.select().from(configSets).where(eq(configSets.code,"v1_0")).for("update");
    if(!set)throw new Error("缺少v1_0配置集");
    const requestId=uuid();let added=0,bound=0;
    const existing=await tx.select().from(skills).where(eq(skills.configSetId,set.id));
    const careerRows=await tx.select().from(careers).where(eq(careers.configSetId,set.id));
    const ids=new Map(existing.map(row=>[row.code,row.id]));
    for(const [sortOrder,definition] of skillContent.entries()){
      const {name,...data}=definition;
      const nameKey=`skill.${definition.code}.name`;
      const values={...data,nameKey,status:"active",sortOrder,notes:`来源：${definition.mechanics.source.document}；${definition.mechanics.source.version}；用户确认采用新版。`};
      const before=existing.find(s=>s.code===definition.code);
      const [text]=await tx.select().from(i18nTexts).where(and(eq(i18nTexts.configSetId,set.id),eq(i18nTexts.code,nameKey),eq(i18nTexts.locale,"zh-CN")));
      if(text&&text.text!==name)throw new Error(`${definition.code} 名称已被修改，导入停止`);
      if(before){
        for(const [key,value] of Object.entries(values))if(canonical(before[key as keyof typeof before])!==canonical(value))throw new Error(`${definition.code}.${key} 与现有配置不同，导入停止，不覆盖人工编辑`);
        if(!text)throw new Error(`${definition.code} 缺少名称文本，请先修复`);
        continue;
      }
      const id=uuid();ids.set(definition.code,id);
      await tx.insert(skills).values({id,configSetId:set.id,...values});
      if(!text)await tx.insert(i18nTexts).values({configSetId:set.id,code:nameKey,locale:"zh-CN",text:name});
      await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:"skill",entityId:id,entityCode:definition.code,revision:1,operation:"create",beforeData:null,afterData:{...values,name},requestId});
      await tx.insert(auditLogs).values({action:"config.skill.import",entityType:"skill",entityId:id,configSetId:set.id,requestId,details:{actorId:actor.id,code:definition.code,sourceHash}});
      added++;
    }
    for(const binding of careerSkillContent){
      const career=careerRows.find(c=>c.code===binding.career);
      if(!career||career.status!=="active"||career.tier!==binding.tier)throw new Error(`${binding.career} 职业缺失、停用或阶段不匹配`);
      const slots=await tx.select().from(careerSkills).where(eq(careerSkills.careerId,career.id)).orderBy(careerSkills.slotIndex);
      const desired=binding.skills.map((code,slotIndex)=>({skillId:ids.get(code)!,slotIndex,unlockLevel:binding.tier*10+1,isDefaultAuto:true}));
      if(slots.length){
        const current=slots.map(({skillId,slotIndex,unlockLevel,isDefaultAuto})=>({skillId,slotIndex,unlockLevel,isDefaultAuto}));
        if(canonical(current)!==canonical(desired))throw new Error(`${career.code} 技能绑定与来源不一致，导入停止`);
        continue;
      }
      await tx.insert(careerSkills).values(desired.map(d=>({...d,careerId:career.id})));
      await tx.update(careers).set({revision:career.revision+1}).where(eq(careers.id,career.id));
      const after={...career,revision:career.revision+1,skills:binding.skills.map((code,i)=>({code,...desired[i],skillId:undefined}))};
      await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:"career",entityId:career.id,entityCode:career.code,revision:career.revision+1,operation:"update",beforeData:{...career,skills:[]},afterData:after,requestId});
      await tx.insert(auditLogs).values({action:"config.career.skills.import",entityType:"career",entityId:career.id,configSetId:set.id,requestId,details:{actorId:actor.id,code:career.code,skills:binding.skills,sourceHash}});
      bound++;
    }
    const errors=validateCultivators(await readCultivators(tx,set.id),true);
    if(errors.length)throw new Error(errors.join("；"));
    if(added||bound){
      await tx.update(configSets).set({currentRevision:sql`${configSets.currentRevision}+1`}).where(eq(configSets.id,set.id));
      await tx.update(configChangeRequests).set({status:"superseded"}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,["draft","submitted","approved"])));
    }
    return {configSet:"v1_0",sourceRevision:set.currentRevision+(added||bound?1:0),addedSkills:added,boundCareers:bound,skills:skillContent.length,mastery:skillContent.filter(s=>s.mechanics.mastery).length,careerStages:careerSkillContent.length,bindings:careerSkillContent.reduce((n,c)=>n+c.skills.length,0),sourceHash};
  });
  if(result.addedSkills||result.boundCareers)await writeFile("Docs/18_技能同步结果.json",JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;}).finally(()=>databasePool.end());
