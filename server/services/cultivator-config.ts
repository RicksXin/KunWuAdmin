import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";
import { v7 as uuid } from "uuid";
import { database } from "@/server/db/client";
import { configSets, careers, careerGrowths, careerSkills, spiritualRoots, realms, heroTemplates, skills, i18nTexts, levelCosts, cultivatorRules, careerRoutes, configEntityRevisions, auditLogs, configChangeRequests } from "@/db/schema";
import { probabilityUpdateSchema,attributes, careerSchema, rootSchema, realmSchema, heroSchema, routeSchema, rulesSchema, mutationSchema, validateCultivators, type Catalog, type CultivatorMutation } from "@/server/domain/cultivators/config";
export class CultivatorConfigError extends Error {constructor(message:string,public status=422){super(message);}}
type Reader=Pick<typeof database,"select">;
const match=(table:{configSetId:AnyMySqlColumn;code:AnyMySqlColumn},setId:string,code:string)=>and(eq(table.configSetId,setId),eq(table.code,code));
const clean=(r:Record<string,unknown>)=>Object.fromEntries(Object.entries(r).filter(([k])=>!["id","configSetId","notes","createdAt","updatedAt","nameKey"].includes(k)));
const cap=(s:string)=>s[0].toUpperCase()+s.slice(1);
export async function readCultivators(db:Reader,setId:string):Promise<Catalog>{
 const [careerRows,roots,realmRows,heroes,skillRows,texts,rules,routes,costs]=await Promise.all([
  db.select().from(careers).where(eq(careers.configSetId,setId)).orderBy(careers.sortOrder,careers.code),
  db.select().from(spiritualRoots).where(eq(spiritualRoots.configSetId,setId)).orderBy(spiritualRoots.rarityOrder),
  db.select().from(realms).where(eq(realms.configSetId,setId)).orderBy(realms.orderIndex),
  db.select().from(heroTemplates).where(eq(heroTemplates.configSetId,setId)).orderBy(heroTemplates.sortOrder,heroTemplates.code),
  db.select().from(skills).where(eq(skills.configSetId,setId)).orderBy(skills.code),
  db.select().from(i18nTexts).where(and(eq(i18nTexts.configSetId,setId),eq(i18nTexts.locale,"zh-CN"))),
  db.select().from(cultivatorRules).where(match(cultivatorRules,setId,"default")),
  db.select().from(careerRoutes).where(eq(careerRoutes.configSetId,setId)).orderBy(careerRoutes.sortOrder,careerRoutes.code),
  db.select().from(levelCosts).where(eq(levelCosts.configSetId,setId)).orderBy(levelCosts.level),
 ]);
 const ids=careerRows.map(c=>c.id);
 const [growth,slots]=ids.length?await Promise.all([
  db.select().from(careerGrowths).where(inArray(careerGrowths.careerId,ids)),
  db.select().from(careerSkills).where(inArray(careerSkills.careerId,ids)).orderBy(careerSkills.slotIndex),
 ]):[[],[]];
 const name=(key:string)=>texts.find(t=>t.code===key)?.text??key;
 return {
  careers:careerRows.map(c=>careerSchema.parse({code:c.code,name:name(c.nameKey),revision:c.revision,status:c.status,sortOrder:c.sortOrder,tier:c.tier,primaryAttribute:c.primaryAttribute,baseHp:c.baseHp,
   base:Object.fromEntries(attributes.map(a=>[a,c[`base${cap(a)}` as keyof typeof c]])),
   growth:Object.fromEntries(attributes.map(a=>[a,(growth.find(g=>g.careerId===c.id) as Record<string,unknown>|undefined)?.[`${a}PerMille`]??0])),
   skills:slots.filter(s=>s.careerId===c.id).map(s=>({code:skillRows.find(x=>x.id===s.skillId)?.code??"missing",unlockLevel:s.unlockLevel,auto:s.isDefaultAuto})),})),
  roots:roots.map(r=>rootSchema.parse({...clean(r),name:name(r.nameKey)})),
  realms:realmRows.map(r=>realmSchema.parse({...clean(r),name:name(r.nameKey)})),
  heroes:heroes.map(h=>heroSchema.parse({code:h.code,name:name(h.nameKey),revision:h.revision,status:h.status,sortOrder:h.sortOrder,careerCode:careerRows.find(c=>c.id===h.careerId)?.code??"missing",rootCode:roots.find(r=>r.id===h.spiritualRootId)?.code??"missing",realmCode:realmRows.find(r=>r.id===h.initialRealmId)?.code??"missing",initialLevel:h.initialLevel,templateClass:h.templateClass??"common",acquisitionWeight:h.acquisitionWeight??0,appearanceCode:h.appearanceCode??h.code,namePool:h.namePool??[name(h.nameKey)],growthFocus:h.growthFocus??"",growthModifiers:h.growthModifiers??undefined,portraitAssetKey:h.portraitAssetKey??""})),
  routes:routes.map(r=>routeSchema.parse(clean(r))),
  rules:rules[0]?rulesSchema.parse({...rules[0].payload,code:"default",revision:rules[0].revision,levelCosts:costs.map(c=>c.soulCrystalCost)}):null,
  skills:skillRows.map(s=>({code:s.code,name:name(s.nameKey),status:s.status})),
 };
}
export async function cultivatorWorkspace(setCode="v1_0"){
 const sets=await database.select({code:configSets.code,name:configSets.name}).from(configSets).orderBy(configSets.code);
 const [set]=await database.select().from(configSets).where(eq(configSets.code,setCode));if(!set)throw new CultivatorConfigError("配置集不存在",404);
 const catalog=await readCultivators(database,set.id);
 return {sets,configSet:set.code,revision:set.currentRevision,...catalog,issues:validateCultivators(catalog,true)};
}
export async function saveCultivatorConfig(setCode:string,rawInput:CultivatorMutation,actorId:string,requestId:string){
 const input=mutationSchema.parse(rawInput);
 return database.transaction(async tx=>{
  const [set]=await tx.select().from(configSets).where(eq(configSets.code,setCode)).for("update");if(!set)throw new CultivatorConfigError("配置集不存在",404);
  const beforeCatalog=await readCultivators(tx,set.id);
  const table=input.kind==="hero"?heroTemplates:input.kind==="career"?careers:input.kind==="root"?spiritualRoots:input.kind==="realm"?realms:input.kind==="route"?careerRoutes:cultivatorRules;
  const v=input.value,code=v.code;
  const [before]=await tx.select().from(table).where(match(table,set.id,code));
  if((before?.revision??0)!==v.revision)throw new CultivatorConfigError("配置已被修改，请刷新后重试",409);
  const id=before?.id??uuid(),revision=(before?.revision??0)+1;
  const meta={id,configSetId:set.id,revision};
  const nameKey=before&&"nameKey" in before?before.nameKey:`${input.kind}.${code}.name`;
  const named="name" in v?{code,nameKey,status:v.status,sortOrder:v.sortOrder,revision}:null;
  if(input.kind==="career"){
   const value=input.value;
   const changes={...named!,tier:value.tier,primaryAttribute:value.primaryAttribute,baseHp:value.baseHp,baseStrength:value.base.strength,baseMagic:value.base.magic,baseTechnique:value.base.technique,baseSpeed:value.base.speed,baseConstitution:value.base.constitution,baseArmor:value.base.armor,baseResistance:value.base.resistance};
   if(before)await tx.update(careers).set(changes).where(eq(careers.id,id));else await tx.insert(careers).values({...changes,...meta});
   await tx.delete(careerGrowths).where(eq(careerGrowths.careerId,id));
   await tx.insert(careerGrowths).values({careerId:id,strengthPerMille:value.growth.strength,magicPerMille:value.growth.magic,techniquePerMille:value.growth.technique,speedPerMille:value.growth.speed,constitutionPerMille:value.growth.constitution,armorPerMille:value.growth.armor,resistancePerMille:value.growth.resistance});
   await tx.delete(careerSkills).where(eq(careerSkills.careerId,id));
   for(const [slotIndex,s] of value.skills.entries()){
    const [skill]=await tx.select().from(skills).where(match(skills,set.id,s.code));if(!skill||skill.status!=="active")throw new CultivatorConfigError(`技能 ${s.code} 不存在或已停用`);
    await tx.insert(careerSkills).values({careerId:id,skillId:skill.id,slotIndex,unlockLevel:s.unlockLevel,isDefaultAuto:s.auto});
   }
  }else if(input.kind==="root"){
   const {basePercent,growthPercent,rarityOrder}=input.value;
   const changes={...named!,basePercent,growthPercent,rarityOrder};
   if(before)await tx.update(spiritualRoots).set(changes).where(eq(spiritualRoots.id,id));else await tx.insert(spiritualRoots).values({...changes,...meta});
  }else if(input.kind==="realm"){
   const {orderIndex,minLevel,maxLevel,breakthroughLevel,breakthroughRecipeCode}=input.value;
   const duplicate=beforeCatalog.realms.find(r=>r.orderIndex===orderIndex&&r.code!==code);if(duplicate)throw new CultivatorConfigError("境界顺序已被其他境界使用");
   const changes={...named!,orderIndex,minLevel,maxLevel,breakthroughLevel,breakthroughRecipeCode};
   if(before)await tx.update(realms).set(changes).where(eq(realms.id,id));else await tx.insert(realms).values({...changes,...meta});
  }else if(input.kind==="hero"){
   const h=input.value;
   const [career]=await tx.select().from(careers).where(match(careers,set.id,h.careerCode));
   const [root]=await tx.select().from(spiritualRoots).where(match(spiritualRoots,set.id,h.rootCode));
   const [realm]=await tx.select().from(realms).where(match(realms,set.id,h.realmCode));
   if(!career||!root||!realm)throw new CultivatorConfigError("职业、灵根或境界引用不存在");
   const changes={...named!,careerId:career.id,spiritualRootId:root.id,initialRealmId:realm.id,initialLevel:h.initialLevel,templateClass:h.templateClass,acquisitionWeight:h.acquisitionWeight,appearanceCode:h.appearanceCode,namePool:h.namePool,growthFocus:h.growthFocus,growthModifiers:h.growthModifiers,portraitAssetKey:h.portraitAssetKey||null};
   if(before)await tx.update(heroTemplates).set(changes).where(eq(heroTemplates.id,id));else await tx.insert(heroTemplates).values({...changes,...meta});
  }else if(input.kind==="route"){
   if(before)await tx.update(careerRoutes).set({...input.value,revision}).where(eq(careerRoutes.id,id));else await tx.insert(careerRoutes).values({...input.value,...meta});
  }else{
   const {code:_code,revision:_revision,levelCosts:costs,...payload}=input.value;void _code;void _revision;
   if(before)await tx.update(cultivatorRules).set({payload,revision}).where(eq(cultivatorRules.id,id));else await tx.insert(cultivatorRules).values({...meta,code:"default",payload});
   // Existing compiler exports level as the target level; maintain one cost source.
   await tx.delete(levelCosts).where(eq(levelCosts.configSetId,set.id));
   await tx.insert(levelCosts).values(costs.map((cost,i)=>({configSetId:set.id,level:i+2,soulCrystalCost:cost})));
  }
  if(named&&input.kind!=="route"){
   const name=(input.value as {name:string}).name;
   const [text]=await tx.select().from(i18nTexts).where(and(eq(i18nTexts.configSetId,set.id),eq(i18nTexts.code,nameKey),eq(i18nTexts.locale,"zh-CN")));
   if(text)await tx.update(i18nTexts).set({text:name,revision:sql`${i18nTexts.revision}+1`}).where(eq(i18nTexts.id,text.id));else await tx.insert(i18nTexts).values({configSetId:set.id,code:nameKey,locale:"zh-CN",text:name});
  }
  const afterCatalog=await readCultivators(tx,set.id);
  const errors=validateCultivators(afterCatalog);if(errors.length)throw new CultivatorConfigError(errors.join("；"));
  const key=input.kind==="hero"?"heroes":input.kind==="career"?"careers":input.kind==="root"?"roots":input.kind==="realm"?"realms":input.kind==="route"?"routes":null;
  const snapshot=(c:Catalog)=>key?c[key].find(r=>r.code===code)??null:c.rules;
  await tx.update(configSets).set({currentRevision:sql`${configSets.currentRevision}+1`}).where(eq(configSets.id,set.id));
  await tx.update(configChangeRequests).set({status:"superseded"}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,["draft","submitted","approved"])));
  await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:`cultivator_${input.kind}`,entityId:id,entityCode:code,revision,operation:before?"update":"create",beforeData:snapshot(beforeCatalog),afterData:snapshot(afterCatalog),requestId});
  await tx.insert(auditLogs).values({action:`config.cultivator.${input.kind}.save`,entityType:`cultivator_${input.kind}`,entityId:id,configSetId:set.id,requestId,details:{actorId,code,revision,configSetRevision:set.currentRevision+1}});
  return {ok:true,revision};
 });
}

export async function saveTemplateProbabilities(setCode:string,raw:unknown,actorId:string,requestId:string){
 const input=probabilityUpdateSchema.parse(raw);
 return database.transaction(async tx=>{
  const [set]=await tx.select().from(configSets).where(eq(configSets.code,setCode)).for("update");
  if(!set)throw new CultivatorConfigError("配置集不存在",404);
  if(set.currentRevision!==input.revision)throw new CultivatorConfigError("配置已被修改，请刷新后重新分配概率",409);
  const before=await readCultivators(tx,set.id);
  if(!before.careers.some(c=>c.code===input.careerCode&&c.status==="active"))throw new CultivatorConfigError("职业不存在或已停用");
  const members=before.heroes.filter(h=>h.careerCode===input.careerCode&&h.status==="active");
  if(members.length!==input.entries.length||members.some(h=>!input.entries.some(e=>e.code===h.code)))throw new CultivatorConfigError("请提交该职业全部启用模板，不能包含其他职业或停用模板");
  for(const entry of input.entries){
   const old=members.find(h=>h.code===entry.code)!;
   const [row]=await tx.select().from(heroTemplates).where(match(heroTemplates,set.id,entry.code));
   await tx.update(heroTemplates).set({acquisitionWeight:entry.basisPoints,revision:old.revision+1}).where(eq(heroTemplates.id,row.id));
   await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:"cultivator_hero",entityId:row.id,entityCode:row.code,revision:old.revision+1,operation:"update",beforeData:old,afterData:{...old,acquisitionWeight:entry.basisPoints,revision:old.revision+1},requestId});
  }
  await tx.update(configSets).set({currentRevision:set.currentRevision+1}).where(eq(configSets.id,set.id));
  await tx.update(configChangeRequests).set({status:"superseded"}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,["draft","submitted","approved"])));
  await tx.insert(auditLogs).values({action:"config.cultivator.probabilities.save",entityType:"cultivator_probability",configSetId:set.id,requestId,details:{actorId,careerCode:input.careerCode,entries:input.entries,revision:set.currentRevision+1}});
  return {ok:true,revision:set.currentRevision+1};
 });
}
