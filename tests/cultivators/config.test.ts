import test from "node:test";
import assert from "node:assert/strict";
import { chooseCultivatorName,templateGrowth,heroSchema,defaultLevelCosts,rulesSchema,careerSchema,realmSchema,routeSchema,validateCultivators,type Catalog } from "../../server/domain/cultivators/config";
const base={code:"test",name:"测试",revision:0,status:"active" as const,sortOrder:0};
const stats={strength:1,magic:1,technique:1,speed:1,constitution:1,armor:1,resistance:1};
test("升级费用节点与魂晶累计一致，不用灵石替代",()=>{for(const [level,total] of [[10,470],[20,3130],[21,3650],[24,5670],[30,12805]])assert.equal(defaultLevelCosts.slice(0,level-1).reduce((a,b)=>a+b,0),total);});
test("拒绝境界倒置、错误门槛、重复技能和循环路线",()=>{
 assert.equal(realmSchema.safeParse({...base,orderIndex:0,minLevel:10,maxLevel:1,breakthroughLevel:10,breakthroughRecipeCode:null}).success,false);
 assert.equal(realmSchema.safeParse({...base,orderIndex:0,minLevel:1,maxLevel:10,breakthroughLevel:5,breakthroughRecipeCode:null}).success,false);
 assert.equal(careerSchema.safeParse({...base,tier:0,primaryAttribute:"strength",baseHp:100,base:stats,growth:stats,skills:[{code:"s",unlockLevel:1,auto:true},{code:"s",unlockLevel:1,auto:true}]}).success,false);
 assert.equal(routeSchema.safeParse({...base,initialCareerCode:"a",foundationCareerCode:"a",coreCareerCode:"c",foundationTrial:"x",coreTrial:"y",coreBonus:stats}).success,false);
});
test("固定初始队伍和培养费用边界",()=>{
 const rules={code:"default",revision:0,maxLevel:30,fixedRoster:["a","b","c","d"],levelCosts:defaultLevelCosts,spiritMax:100,spiritRecoverySeconds:300,foundationStone:300,coreStone:1200,coreDiscount:300,corePillCode:"pill",foundationQuest:"q1",coreQuest:"q2",discountQuest:"q3",foundationResetStone:3000,coreResetStone:9000,revive:[{realmCode:"r1",base:20,perLevel:8,offset:0},{realmCode:"r2",base:100,perLevel:15,offset:10},{realmCode:"r3",base:300,perLevel:25,offset:20}]};
 assert.ok(rulesSchema.safeParse(rules).success);
 assert.ok(rulesSchema.safeParse({...rules,fixedRoster:["a","a","b","c"]}).success);
 for(const patch of [{levelCosts:[20]},{coreDiscount:1200},{maxLevel:60},{spiritRecoverySeconds:0}])assert.equal(rulesSchema.safeParse({...rules,...patch}).success,false);
});
test("草稿允许尚未配置技能，发布阻止缺失路线与技能",()=>{
 const c:Catalog={heroes:[],roots:[],realms:[],routes:[],skills:[],rules:null,careers:[{...base,tier:0,primaryAttribute:"strength",baseHp:100,base:stats,growth:stats,skills:[]}]};
 assert.deepEqual(validateCultivators(c),[]);
 assert.ok(validateCultivators({...c,heroes:[heroSchema.parse({...base,careerCode:"missing",rootCode:"root",realmCode:"realm",initialLevel:1,portraitAssetKey:""})]}).length);
});

test("同一职业的模板独立成长、姓名独立抽取且固定名优先",()=>{
 assert.ok(Math.abs(templateGrowth(2200,1500,100)-3.3)<1e-10);
 assert.equal(templateGrowth(2600,850,100),2.21);
 assert.equal(chooseCultivatorName(["慧山","静海"],"",()=>0),"慧山");
 assert.equal(chooseCultivatorName(["慧山","静海"],"",()=>0.99),"静海");
 assert.equal(chooseCultivatorName(["慧山","静海"],"石岩"),"石岩");
 assert.throws(()=>chooseCultivatorName([]));
 const hero={...base,careerCode:"wu_xiu",rootCode:"root",realmCode:"realm",initialLevel:1,portraitAssetKey:""};
 assert.equal(heroSchema.safeParse({...hero,namePool:[]}).success,false);
 assert.equal(heroSchema.safeParse({...hero,namePool:["慧山","慧山"]}).success,false);
});

test("十二模板每职业一普通两优秀，默认渠道按职业隔离并排除停用和零权重",async()=>{
 const {templateDrafts}=await import("../../server/domain/cultivators/templates");
 const {templateProbabilities}=await import("../../server/domain/cultivators/config");
 const heroes=templateDrafts.map(h=>heroSchema.parse(h));
 assert.equal(heroes.length,12);assert.equal(new Set(heroes.map(h=>h.code)).size,12);
 for(const career of ["wu_xiu","fa_xiu","yi_xiu","qian_xiu"]){
  const group=heroes.filter(h=>h.careerCode===career);
  assert.equal(group.filter(h=>h.templateClass==="common").length,1);
  assert.equal(group.filter(h=>h.templateClass==="excellent").length,2);
  assert.deepEqual(templateProbabilities(heroes,career).map(p=>p.probability),[0.8,0.1,0.1]);
 }
 const changed=heroes.map(h=>h.code==="hero_wu_xiu_01"?{...h,status:"disabled" as const}:h.code==="hero_wu_xiu_02"?{...h,acquisitionWeight:0}:h);
 assert.deepEqual(templateProbabilities(changed,"wu_xiu"),[{code:"hero_wu_xiu_common",probability:1}]);
 assert.deepEqual(templateProbabilities(changed,"missing"),[]);
 assert.equal(heroSchema.safeParse({...heroes[0],acquisitionWeight:-1}).success,false);
 assert.equal(heroSchema.safeParse({...heroes[0],templateClass:"rare"}).success,false);
});


test("概率百分比校验与舍入保持100%，支持0%和100%",async()=>{
 const {probabilityUpdateSchema,probabilityBasisPoints}=await import("../../server/domain/cultivators/config");
 const {templateDrafts}=await import("../../server/domain/cultivators/templates");
 const heroes=templateDrafts.slice(0,3).map(h=>heroSchema.parse({...h,acquisitionWeight:1}));
 const entries=probabilityBasisPoints(heroes,"wu_xiu");
 assert.deepEqual(entries.map(e=>e.basisPoints),[3334,3333,3333]);
 assert.ok(probabilityUpdateSchema.safeParse({revision:1,careerCode:"wu_xiu",entries}).success);
 for(const values of [[100,100,100],[10000,0,-1],[9999.5,0.5,0]])assert.equal(probabilityUpdateSchema.safeParse({revision:1,careerCode:"wu_xiu",entries:entries.map((e,i)=>({...e,basisPoints:values[i]}))}).success,false);
 assert.ok(probabilityUpdateSchema.safeParse({revision:1,careerCode:"wu_xiu",entries:entries.map((e,i)=>({...e,basisPoints:i===0?10000:0}))}).success);
 assert.deepEqual(probabilityBasisPoints(heroes.map(h=>({...h,acquisitionWeight:0})),"wu_xiu").map(e=>e.basisPoints),[0,0,0]);
});
