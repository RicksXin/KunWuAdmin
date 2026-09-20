/** 1.0 draft only. Upgrade unclassified legacy templates once; preserve configured rows and D0. */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { database,databasePool } from "../server/db/client";
import { ResourceService } from "../server/services/resource-service";
import { cultivatorWorkspace,saveCultivatorConfig } from "../server/services/cultivator-config";
import { attributes,defaultLevelCosts,type CultivatorMutation } from "../server/domain/cultivators/config";
import { eq } from "drizzle-orm";
import { configSets,heroTemplates } from "../db/schema";
import { templateDrafts,initialRoster } from "../server/domain/cultivators/templates";
const stats=(values:number[])=>Object.fromEntries(attributes.map((a,i)=>[a,values[i]])) as Record<typeof attributes[number],number>;
async function main(){
 const set=process.argv[2]??"v1_0";if(set!=="v1_0")throw new Error("初始化仅用于 v1_0 草稿，不覆盖旧版本");
 const local=JSON.parse(await readFile(".local/resource-development.json","utf8"));
 const actor=await new ResourceService(databasePool).authenticate(local.adminToken,"admin");if(actor.environment!=="development"||!actor.permissions.includes("config.write"))throw new Error("开发身份权限不足");
 let workspace=await cultivatorWorkspace(set),created=0;
 async function save(m:CultivatorMutation){const key=m.kind==="hero"?"heroes":m.kind==="career"?"careers":m.kind==="root"?"roots":m.kind==="realm"?"realms":m.kind==="route"?"routes":null;if(key?workspace[key].some(r=>r.code===m.value.code):!!workspace.rules)return;await saveCultivatorConfig(set,m,actor.id,crypto.randomUUID());created++;workspace=await cultivatorWorkspace(set);}
 const common={revision:0,status:"active" as const,sortOrder:0};
 const roots=[['mixed_root','杂灵根',100,100],['pseudo_root','伪灵根',108,110],['triple_root','三灵根',116,122],['dual_root','双灵根',124,136],['heavenly_root','天灵根',133,152],['variant_root','异灵根',152,190]] as const;
 for(const [i,[code,name,basePercent,growthPercent]] of roots.entries())await save({kind:"root",value:{...common,code,name,basePercent,growthPercent,rarityOrder:i,sortOrder:i}});
 for(const [i,[code,name]] of ([['lian_qi','炼气'],['zhu_ji','筑基'],['jie_dan','结丹']] as const).entries())await save({kind:"realm",value:{...common,code,name,orderIndex:i,minLevel:i*10+1,maxLevel:(i+1)*10,breakthroughLevel:i<2?(i+1)*10:null,breakthroughRecipeCode:null,sortOrder:i}});
 const careers=[
  {code:"wu_xiu",name:"金刚禅修",primaryAttribute:"strength" as const,baseHp:120,base:stats([14,4,7,8,13,11,6]),growth:stats([2200,200,500,400,2600,1800,700])},
  {code:"fa_xiu",name:"五行法修",primaryAttribute:"magic" as const,baseHp:84,base:stats([4,15,10,8,7,4,11]),growth:stats([200,3000,2000,400,800,600,1200])},
  {code:"yi_xiu",name:"玄箓修",primaryAttribute:"magic" as const,baseHp:92,base:stats([4,13,11,9,8,5,12]),growth:stats([200,2800,1600,500,900,600,1800])},
  {code:"qian_xiu",name:"剑修",primaryAttribute:"technique" as const,baseHp:96,base:stats([10,5,14,14,8,6,6]),growth:stats([1800,200,2200,1600,1000,800,600])},
 ];
 for(const [i,c] of careers.entries())await save({kind:"career",value:{...common,...c,tier:0,skills:[],sortOrder:i}});
 const routes=[
  [0,'hu_fa_jin_shen','护法金身','bu_dong_jin_gang','不动金刚',[1700,200,500,300,3000,3000,1300],[4,0,1,0,7,8,5]],
  [0,'mo_xiang_li_shi','魔相力士','san_xiang_mo_jun','三相魔君',[3300,200,700,900,2500,1400,1000],[9,0,2,2,6,4,2]],
  [1,'lei_fa_shu_shi','雷法术式','jiu_xiao_lei_jun','九霄雷君',[200,3300,2200,700,700,500,1400],[0,9,6,3,1,1,5]],
  [1,'shen_jing_huan_fa','蜃景幻法','shen_meng_xuan_jun','蜃梦玄君',[200,3000,2600,900,700,500,1100],[0,8,8,4,1,1,3]],
  [2,'zhen_you_fu_mai','镇幽符脉','zhen_hun_fu_jun','镇魂符君',[200,2700,1700,600,900,600,2200],[0,7,5,1,2,1,9]],
  [2,'wan_xiang_fu_mai','万象符脉','tian_yuan_fu_jun','天元符君',[200,2500,2200,700,1100,900,1500],[0,6,7,2,3,3,4]],
  [3,'qing_ming_jian_xiu','青冥剑修','qing_ming_jian_jun','青冥剑君',[1700,200,3200,2300,700,500,400],[4,0,9,8,2,1,1]],
  [3,'xuan_yue_jian_xiu','玄岳剑修','xuan_yue_jian_jun','玄岳剑君',[3400,200,900,500,2000,1600,600],[10,0,3,0,6,5,1]],
 ] as const;
 for(const [i,[parent,foundation,name,core,coreName,growth,bonus]] of routes.entries()){
  for(const [tier,code,label] of [[1,foundation,name],[2,core,coreName]] as const)await save({kind:"career",value:{...common,...careers[parent],code,name:label,tier,growth:stats([...growth]),skills:[],sortOrder:10+i*2+tier}});
  await save({kind:"route",value:{...common,code:`route_${foundation}`,name:`${name} → ${coreName}`,initialCareerCode:careers[parent].code,foundationCareerCode:foundation,coreCareerCode:core,foundationTrial:`trial_foundation_${careers[parent].code}`,coreTrial:`trial_core_${foundation}`,coreBonus:stats([...bonus]),sortOrder:i}});
 }
 const [configSet]=await database.select().from(configSets).where(eq(configSets.code,set));
 const stored=await database.select().from(heroTemplates).where(eq(heroTemplates.configSetId,configSet.id));
 for(const preset of templateDrafts){
  const old=workspace.heroes.find(h=>h.code===preset.code);
  if(!old)await save({kind:"hero",value:preset});
  else if(stored.find(h=>h.code===preset.code)?.templateClass===null){
   await saveCultivatorConfig(set,{kind:"hero",value:{...old,...preset,namePool:old.namePool,portraitAssetKey:old.portraitAssetKey,rootCode:old.rootCode,status:old.status,revision:old.revision}},actor.id,crypto.randomUUID());created++;
  }
 }
 await save({kind:"rules",value:{code:"default",revision:0,maxLevel:30,fixedRoster:initialRoster,fixedNames:["石岩","陆清","白灵","墨言"],levelCosts:defaultLevelCosts,spiritMax:100,spiritRecoverySeconds:300,foundationStone:300,coreStone:1200,coreDiscount:300,corePillCode:"dustfall_pill",foundationQuest:"four_array_eyes",coreQuest:"map_03_main",discountQuest:"borrow_array",foundationResetStone:3000,coreResetStone:9000,revive:[{realmCode:"lian_qi",base:20,perLevel:8,offset:0},{realmCode:"zhu_ji",base:100,perLevel:15,offset:10},{realmCode:"jie_dan",base:300,perLevel:25,offset:20}]}});
 console.log(`CULTIVATOR_DRAFT_SETUP_OK created=${created}; skills and authoritative quest bindings pending; no release published`);
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;}).finally(()=>databasePool.end());
