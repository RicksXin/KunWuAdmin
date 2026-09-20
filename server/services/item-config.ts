import "server-only";
import { marketSchema } from "@/server/domain/items/market";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";
import { and, eq, inArray, sql } from "drizzle-orm";
import { v7 as uuid } from "uuid";
import { database } from "@/server/db/client";
import { auditLogs, configEntityRevisions, configChangeRequests, configSets, marketConfigs, gameAssets, i18nTexts, itemDefinitions, itemQualities, itemQualitySchemes, craftingRecipes, buildings, buildingLevels } from "@/db/schema";
import { type Catalog, type ItemMutation, itemSchema, qualitySchema, schemeSchema, recipeSchema, workshopSchema, validateCatalog, mutationSchema } from "@/server/domain/items/config";
export class ItemConfigError extends Error { constructor(message:string,public status=422){super(message);} }
type Reader = Pick<typeof database,"select">;
const match = (table: {configSetId:AnyMySqlColumn;code:AnyMySqlColumn},setId:string,code:string)=>and(eq(table.configSetId,setId),eq(table.code,code));
export async function readItemCatalog(db:Reader,setId:string):Promise<Catalog> {
  const [assets,defs,qualities,schemes,recipes,workshops,markets]=await Promise.all([
    db.select().from(gameAssets).where(eq(gameAssets.configSetId,setId)).orderBy(gameAssets.code),
    db.select().from(itemDefinitions).where(eq(itemDefinitions.configSetId,setId)).orderBy(itemDefinitions.sortOrder,itemDefinitions.code),
    db.select().from(itemQualities).where(eq(itemQualities.configSetId,setId)).orderBy(itemQualities.sortOrder,itemQualities.code),
    db.select().from(itemQualitySchemes).where(eq(itemQualitySchemes.configSetId,setId)).orderBy(itemQualitySchemes.sortOrder,itemQualitySchemes.code),
    db.select().from(craftingRecipes).where(eq(craftingRecipes.configSetId,setId)).orderBy(craftingRecipes.sortOrder,craftingRecipes.code),
    db.select().from(buildings).where(match(buildings,setId,"lian_qi_fang")),
    db.select().from(marketConfigs).where(match(marketConfigs,setId,"default")),
  ]);
  const clean=(r:Record<string,unknown>)=>Object.fromEntries(Object.entries(r).filter(([k])=>!["id","configSetId","notes","createdAt","updatedAt","assetId"].includes(k)));
  const workshop=workshops[0];
  const levels=workshop ? await db.select().from(buildingLevels).where(eq(buildingLevels.buildingId,workshop.id)).orderBy(buildingLevels.level):[];
  const configured=workshop?.maxLevel===24&&workshop.initialLevel===1&&levels.length===23&&levels.every((l,i)=>l.level===i+2&&l.upgradeCostAssetId===levels[0].upgradeCostAssetId)&&workshop.status==="active";
  return {
    market:markets[0]?marketSchema.parse({...markets[0].payload,code:"default",revision:markets[0].revision}):null,
    assets:assets.map(({code,assetType,status})=>({code,assetType,status})),
    items:defs.map(d=>{const a=assets.find(a=>a.id===d.assetId);if(!a||a.code!==d.code)throw new ItemConfigError(`${d.code} 资产关联不一致`);return itemSchema.parse({...clean(d),details:d.details??undefined,qualityCode:a.qualityCode,stackLimit:a.stackLimit,iconPath:a.iconPath??"",isProtected:a.isProtected,isDiscardable:a.isDiscardable,status:a.status==="active"?d.status:"disabled"});}),
    qualities:qualities.filter(q=>q.schemeCode==="unified").map(q=>qualitySchema.parse(clean(q))),schemes:schemes.filter(s=>s.code==="unified").map(s=>schemeSchema.parse(clean(s))),recipes:recipes.map(r=>recipeSchema.parse({...clean(r),outcomes:r.outcomes??[]})),
    workshop:configured?workshopSchema.parse({revision:workshop.revision,woodCode:assets.find(a=>a.id===levels[0].upgradeCostAssetId)?.code,costs:levels.map(l=>l.upgradeCostAmount)}):null,
  };
}
export async function itemWorkspace(setCode?:string) {
  const sets=await database.select({code:configSets.code,name:configSets.name}).from(configSets).orderBy(configSets.code);
  const selected=setCode??(sets.some(s=>s.code==="v1_0")?"v1_0":sets[0]?.code);
  const [set]=await database.select().from(configSets).where(eq(configSets.code,selected??""));
  if(!set)throw new ItemConfigError("配置集不存在",404);
  const [workshop]=await database.select().from(buildings).where(match(buildings,set.id,"lian_qi_fang"));
  return {sets,configSet:set.code,revision:set.currentRevision,workshopRevision:workshop?.revision??0,...await readItemCatalog(database,set.id)};
}
export async function saveItemConfig(setCode:string,rawInput:ItemMutation,actorId:string,requestId:string,options:{adoptExistingAssets?:boolean}={}) {
  const input=mutationSchema.parse(rawInput);
  return database.transaction(async tx=>{
    const [set]=await tx.select().from(configSets).where(eq(configSets.code,setCode)).for("update");
    if(!set)throw new ItemConfigError("配置集不存在",404);
    const beforeCatalog=await readItemCatalog(tx,set.id);
    const table=input.kind==="item"?itemDefinitions:input.kind==="quality"?itemQualities:input.kind==="scheme"?itemQualitySchemes:input.kind==="recipe"?craftingRecipes:input.kind==="market"?marketConfigs:buildings;
    const code=input.kind==="workshop"?"lian_qi_fang":input.value.code;
    const [before]=await tx.select().from(table).where(match(table,set.id,code));
    if((before?.revision??0)!==input.value.revision)throw new ItemConfigError("配置已更新，请刷新后重新编辑",409);
    const id=before?.id??uuid(),revision=(before?.revision??0)+1;
    const meta={id,configSetId:set.id,revision};
    if(input.kind==="item") {
      const {stackLimit,qualityCode,iconPath,isProtected,isDiscardable,...definition}=input.value;
      const [asset]=await tx.select().from(gameAssets).where(match(gameAssets,set.id,code));
      // Existing assets belong to other editors/imports; adopting them requires an explicit migration.
      if(asset&&!before&&!options.adoptExistingAssets)throw new ItemConfigError("该编码已存在于资产目录，请使用新编码；旧资产需迁移后管理",409);
      const assetId=asset?.id??uuid();
      const nameKey=asset?.nameKey??`item.${code}.name`;
      const assetValue={stackLimit,qualityCode,iconPath:iconPath||null,isProtected,isDiscardable,status:definition.status,sortOrder:definition.sortOrder};
      if(asset)await tx.update(gameAssets).set({...assetValue,revision:sql`${gameAssets.revision}+1`}).where(eq(gameAssets.id,assetId));
      else await tx.insert(gameAssets).values({...assetValue,id:assetId,configSetId:set.id,code,assetType:"item",nameKey,storageKind:"inventory"});
      if(before)await tx.update(itemDefinitions).set({...definition,revision}).where(eq(itemDefinitions.id,id));
      else await tx.insert(itemDefinitions).values({...definition,...meta,assetId});
      const [text]=await tx.select().from(i18nTexts).where(and(eq(i18nTexts.configSetId,set.id),eq(i18nTexts.code,nameKey),eq(i18nTexts.locale,"zh-CN")));
      if(text)await tx.update(i18nTexts).set({text:definition.name,revision:sql`${i18nTexts.revision}+1`}).where(eq(i18nTexts.id,text.id));
      else await tx.insert(i18nTexts).values({configSetId:set.id,code:nameKey,locale:"zh-CN",text:definition.name});
    } else if(input.kind==="scheme") {
      if(before)await tx.update(itemQualitySchemes).set({...input.value,revision}).where(eq(itemQualitySchemes.id,id));
      else await tx.insert(itemQualitySchemes).values({...input.value,...meta});
    } else if(input.kind==="quality") {
      if(before)await tx.update(itemQualities).set({...input.value,revision}).where(eq(itemQualities.id,id));
      else await tx.insert(itemQualities).values({...input.value,...meta});
    } else if(input.kind==="recipe") {
      if(before)await tx.update(craftingRecipes).set({...input.value,revision}).where(eq(craftingRecipes.id,id));
      else await tx.insert(craftingRecipes).values({...input.value,...meta});
    } else if(input.kind==="market"){
      const {revision:_revision,...payload}=input.value;void _revision;
      if(before)await tx.update(marketConfigs).set({payload,revision}).where(eq(marketConfigs.id,id));else await tx.insert(marketConfigs).values({...meta,code:"default",payload});
    } else {
      const [wood]=await tx.select().from(gameAssets).where(match(gameAssets,set.id,input.value.woodCode));
      if(!wood||wood.code!=="spiritWood"||wood.status!=="active")throw new ItemConfigError("当前配置集缺少启用的灵木资源 spiritWood");
      if(before)await tx.update(buildings).set({revision,maxLevel:24,initialLevel:1,status:"active"}).where(eq(buildings.id,id));
      else await tx.insert(buildings).values({...meta,code,nameKey:"building.lian_qi_fang",maxLevel:24,initialLevel:1});
      await tx.delete(buildingLevels).where(eq(buildingLevels.buildingId,id));
      await tx.insert(buildingLevels).values(input.value.costs.map((cost,i)=>({buildingId:id,level:i+2,upgradeCostAssetId:wood.id,upgradeCostAmount:cost})));
    }
    const afterCatalog=await readItemCatalog(tx,set.id);
    const errors=validateCatalog(afterCatalog);if(errors.length)throw new ItemConfigError(errors.join("；"));
    await tx.update(configSets).set({currentRevision:sql`${configSets.currentRevision}+1`}).where(eq(configSets.id,set.id));
    await tx.update(configChangeRequests).set({status:"superseded"}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,["draft","submitted","approved"])));
    const collection=input.kind==="item"?"items":input.kind==="quality"?"qualities":input.kind==="scheme"?"schemes":input.kind==="recipe"?"recipes":null;
    const snapshot=(c:Catalog)=>collection?c[collection].find(row=>row.code===code)??null:input.kind==="market"?c.market??null:c.workshop;
    await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:`item_${input.kind}`,entityId:id,entityCode:code,revision,operation:before?"update":"create",beforeData:snapshot(beforeCatalog),afterData:snapshot(afterCatalog),requestId});
    await tx.insert(auditLogs).values({action:`config.item.${input.kind}.save`,entityType:`item_${input.kind}`,entityId:id,configSetId:set.id,requestId,details:{actorId,actorKind:"resource_admin",code,revision,configSetRevision:set.currentRevision+1}});
    return {ok:true,revision};
  });
}
