import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { v7 as uuid } from "uuid";
import { eq,inArray } from "drizzle-orm";
import { database,databasePool } from "../../server/db/client";
import { configSets,careers,careerGrowths,careerSkills,spiritualRoots,realms,heroTemplates,skills,i18nTexts,levelCosts,cultivatorRules,careerRoutes,configEntityRevisions,auditLogs,configChangeRequests } from "../../db/schema";
import { saveTemplateProbabilities,cultivatorWorkspace,saveCultivatorConfig } from "../../server/services/cultivator-config";
import { compileConfigModules } from "../../server/compiler/config-compiler";
import { defaultLevelCosts,type CultivatorMutation } from "../../server/domain/cultivators/config";
test("修士配置事务、跨集引用、并发修订、发布内容与审核失效",async()=>{
 const id=uuid(),code=`test_cultivators_${Date.now()}`,actor=uuid();
 const base={revision:0,status:"active" as const,sortOrder:0,name:"测试"};
 const stat={strength:1000,magic:1000,technique:1000,speed:1000,constitution:1000,armor:1000,resistance:1000};
 const save=(m:CultivatorMutation)=>saveCultivatorConfig(code,m,actor,uuid());
 try{
  await database.insert(configSets).values({id,code,name:"修士集成测试"});
  await database.insert(skills).values([0,1,2].map(i=>({configSetId:id,code:`skill_${i}`,nameKey:`skill.${i}`,damageKind:"none",targetType:"SELF",baseIntervalTicks:10})));
  const slots=[0,1,2].map(i=>({code:`skill_${i}`,unlockLevel:1,auto:true}));
  for(const [careerCode,tier] of [["base",0],["branch_a",1],["branch_b",1],["core_a",2],["core_b",2]] as const)await save({kind:"career",value:{...base,code:careerCode,tier,primaryAttribute:"strength",baseHp:100,base:stat,growth:stat,skills:slots}});
  await save({kind:"root",value:{...base,code:"root",basePercent:100,growthPercent:100,rarityOrder:0}});
  for(let i=0;i<3;i++)await save({kind:"realm",value:{...base,code:`realm_${i}`,orderIndex:i,minLevel:i*10+1,maxLevel:(i+1)*10,breakthroughLevel:i<2?(i+1)*10:null,breakthroughRecipeCode:null}});
  for(let i=0;i<4;i++)await save({kind:"hero",value:{...base,code:`hero_${i}`,templateClass:"excellent",acquisitionWeight:10,appearanceCode:`monk_${i}`,namePool:["慧山","静海"],growthModifiers:{...stat,strength:1500},careerCode:"base",rootCode:"root",realmCode:"realm_0",initialLevel:1,portraitAssetKey:""}});
  for(const suffix of ["a","b"])await save({kind:"route",value:{...base,code:`route_${suffix}`,initialCareerCode:"base",foundationCareerCode:`branch_${suffix}`,coreCareerCode:`core_${suffix}`,foundationTrial:"trial",coreTrial:"core_trial",coreBonus:stat}});
  await save({kind:"rules",value:{code:"default",revision:0,maxLevel:30,fixedRoster:[0,0,2,3].map(i=>`hero_${i}`),fixedNames:["石岩","","白灵","墨言"],levelCosts:defaultLevelCosts,spiritMax:100,spiritRecoverySeconds:300,foundationStone:300,coreStone:1200,coreDiscount:300,corePillCode:"pill",foundationQuest:"q1",coreQuest:"q2",discountQuest:"q3",foundationResetStone:3000,coreResetStone:9000,revive:[0,1,2].map(i=>({realmCode:`realm_${i}`,base:20,perLevel:8,offset:i*10}))}});
  const before=await cultivatorWorkspace(code);assert.deepEqual(before.issues,[]);
  await assert.rejects(()=>save({kind:"root",value:{...before.roots[0],status:"disabled"}}),/灵根/);
  await assert.rejects(()=>save({kind:"hero",value:{...before.heroes[0],careerCode:"other_set_career"}}),/不存在/);
  await assert.rejects(()=>save({kind:"career",value:{...before.careers[0],growth:{...stat,strength:5000},skills:[{code:"missing",unlockLevel:1,auto:true}]}}),/技能/);
  const rolledBack=await cultivatorWorkspace(code);assert.equal(rolledBack.revision,before.revision);assert.deepEqual(rolledBack.careers,before.careers);
  const change=uuid();await database.insert(configChangeRequests).values({id:change,configSetId:id,sourceRevision:before.revision,title:"测试审批",status:"approved"});
  const attempts=await Promise.allSettled([save({kind:"hero",value:{...before.heroes[0],name:"修改甲"}}),save({kind:"hero",value:{...before.heroes[0],name:"修改乙"}})]);
  assert.equal(attempts.filter(x=>x.status==="fulfilled").length,1);
  const [approval]=await database.select().from(configChangeRequests).where(eq(configChangeRequests.id,change));assert.equal(approval.status,"superseded");
  const probabilityBefore=await cultivatorWorkspace(code);
  const probabilities={revision:probabilityBefore.revision,careerCode:"base",entries:[0,1,2,3].map(i=>({code:`hero_${i}`,basisPoints:[7000,2000,1000,0][i]}))};
  await assert.rejects(()=>saveTemplateProbabilities(code,{...probabilities,entries:probabilities.entries.slice(0,3)},actor,uuid()),/全部启用模板/);
  assert.equal((await cultivatorWorkspace(code)).revision,probabilityBefore.revision);
  await saveTemplateProbabilities(code,probabilities,actor,uuid());
  await assert.rejects(()=>saveTemplateProbabilities(code,probabilities,actor,uuid()),/已被修改/);
  const after=await cultivatorWorkspace(code);const modules=await compileConfigModules(database,id,1,after.revision);
  const progression=modules.find(m=>m.moduleCode==="progression")!.payload as {cultivatorConfigVersion:number;heroTemplates:{templateClass:string;acquisitionWeight:number;appearanceCode:string;namePool:string[];growthModifiers:{strength:number}}[];cultivatorRules:{fixedNames:string[];fixedRoster:string[]};cultivatorRuntimeEnabled:boolean;careerRoutes:unknown[];levelCosts:{level:number;soulCrystalCost:number}[]};
  assert.equal(progression.cultivatorConfigVersion,2);assert.equal(progression.heroTemplates[0].templateClass,"excellent");assert.equal(progression.heroTemplates[0].acquisitionWeight,7000);assert.equal(progression.heroTemplates[0].appearanceCode,"monk_0");assert.deepEqual(progression.heroTemplates[0].namePool,["慧山","静海"]);assert.equal(progression.heroTemplates[0].growthModifiers.strength,1500);assert.deepEqual(progression.cultivatorRules.fixedNames,["石岩","","白灵","墨言"]);assert.equal(progression.cultivatorRules.fixedRoster[0],progression.cultivatorRules.fixedRoster[1]);assert.equal(progression.cultivatorRuntimeEnabled,false);assert.equal(progression.careerRoutes.length,2);assert.deepEqual(progression.levelCosts.find(c=>c.level===11),{level:11,soulCrystalCost:130});
  await save({kind:"career",value:{...after.careers[0],skills:[]}});
  assert.ok((await cultivatorWorkspace(code)).issues.some(i=>i.includes("三个")));
  await assert.rejects(()=>compileConfigModules(database,id,1,after.revision+1),/三个/);
  const revisions=await database.select().from(configEntityRevisions).where(eq(configEntityRevisions.configSetId,id));assert.ok(revisions.every(r=>r.afterData));
 }finally{
  for(const t of [heroTemplates,careerRoutes,cultivatorRules,levelCosts,spiritualRoots,realms,i18nTexts,configEntityRevisions,auditLogs,configChangeRequests])await database.delete(t).where(eq(t.configSetId,id));
  const rows=await database.select().from(careers).where(eq(careers.configSetId,id));if(rows.length){const ids=rows.map(r=>r.id);await database.delete(careerSkills).where(inArray(careerSkills.careerId,ids));await database.delete(careerGrowths).where(inArray(careerGrowths.careerId,ids));}
  await database.delete(careers).where(eq(careers.configSetId,id));await database.delete(skills).where(eq(skills.configSetId,id));await database.delete(configSets).where(eq(configSets.id,id));await databasePool.end();
 }
});
