import { and, eq, inArray, sql } from "drizzle-orm";
import { v7 as uuid } from "uuid";
import { database } from "../server/db/client";
import { configSets, itemQualities, itemQualitySchemes, itemDefinitions, gameAssets, craftingRecipes, i18nTexts, configEntityRevisions, configChangeRequests, auditLogs } from "../db/schema";
import { qualityLevels, legacyQualityCodes, unifiedQualityScheme } from "../server/domain/items/quality";

/** Draft-only, atomic and repeatable. Published releases remain immutable. */
export async function migrateItemQualities(setCode:string,actorId:string){
 return database.transaction(async tx=>{
  const [set]=await tx.select().from(configSets).where(eq(configSets.code,setCode)).for("update");
  if(!set)throw new Error("配置集不存在");
  const requestId=uuid();let changed=0;
  const audit=async(type:string,before:Record<string,unknown>|null,after:Record<string,unknown>)=>{
   changed++;await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:type,entityId:String(after.id),entityCode:String(after.code),revision:Number(after.revision),operation:before?"update":"create",beforeData:before,afterData:after,requestId});
  };
  const schemes=await tx.select().from(itemQualitySchemes).where(eq(itemQualitySchemes.configSetId,set.id));
  const scheme=schemes.find(s=>s.code==="unified");
  if(!scheme){const row={...unifiedQualityScheme,id:uuid(),configSetId:set.id,revision:1};await tx.insert(itemQualitySchemes).values(row);await audit("item_scheme",null,row);}
  for(const row of schemes.filter(s=>s.code!=="unified"&&s.status!=="disabled")){const after={...row,status:"disabled",revision:row.revision+1};await tx.update(itemQualitySchemes).set({status:after.status,revision:after.revision}).where(eq(itemQualitySchemes.id,row.id));await audit("item_scheme",row,after);}
  const qualities=await tx.select().from(itemQualities).where(eq(itemQualities.configSetId,set.id));
  for(const level of qualityLevels){
   const before=qualities.find(q=>q.code===level.code);
   if(before&&before.name===level.name&&before.sortOrder===level.sortOrder&&before.schemeCode==="unified"&&before.status==="active")continue;
   const after={...level,color:before?.color??level.color,id:before?.id??uuid(),configSetId:set.id,schemeCode:"unified",status:"active",revision:(before?.revision??0)+1};
   if(before)await tx.update(itemQualities).set(after).where(eq(itemQualities.id,before.id));else await tx.insert(itemQualities).values(after);
   await audit("item_quality",before??null,after);
  }
  const assets=await tx.select().from(gameAssets).where(eq(gameAssets.configSetId,set.id));
  for(const before of assets.filter(a=>a.qualityCode&&!qualityLevels.some(q=>q.code===a.qualityCode))){
   const mapped=legacyQualityCodes[before.qualityCode!];if(!mapped)throw new Error(`未知旧品级 ${before.qualityCode}，未修改该配置集`);
   const after={...before,qualityCode:mapped,revision:before.revision+1};await tx.update(gameAssets).set({qualityCode:mapped,revision:after.revision}).where(eq(gameAssets.id,before.id));await audit("game_asset",before,after);
   const [definition]=await tx.select().from(itemDefinitions).where(eq(itemDefinitions.assetId,before.id));
   if(definition){
    const oldQuality=qualities.find(q=>q.code===before.qualityCode),level=qualityLevels.find(q=>q.code===mapped)!;
    const name=oldQuality&&definition.name===`${oldQuality.name}铁胚`?`${level.name}铁胚`:definition.name;
    const updated={...definition,name,revision:definition.revision+1};await tx.update(itemDefinitions).set({name,revision:updated.revision}).where(eq(itemDefinitions.id,definition.id));await audit("item_item",definition,updated);
    if(name!==definition.name){
     const texts=await tx.select().from(i18nTexts).where(and(eq(i18nTexts.configSetId,set.id),eq(i18nTexts.code,before.nameKey),eq(i18nTexts.locale,"zh-CN")));
     for(const text of texts){await tx.update(i18nTexts).set({text:name,revision:text.revision+1}).where(eq(i18nTexts.id,text.id));await audit("i18n_text",text,{...text,text:name,revision:text.revision+1});}
     const recipes=await tx.select().from(craftingRecipes).where(and(eq(craftingRecipes.configSetId,set.id),eq(craftingRecipes.outputCode,before.code)));
     for(const recipe of recipes.filter(r=>r.name===`炼制${definition.name}`)){
      const next={...recipe,name:`炼制${name}`,revision:recipe.revision+1};await tx.update(craftingRecipes).set({name:next.name,revision:next.revision}).where(eq(craftingRecipes.id,recipe.id));await audit("item_recipe",recipe,next);
     }
    }
   }
  }
  for(const before of qualities.filter(q=>!qualityLevels.some(l=>l.code===q.code)&&q.status!=="disabled")){
   const after={...before,status:"disabled",revision:before.revision+1};await tx.update(itemQualities).set({status:"disabled",revision:after.revision}).where(eq(itemQualities.id,before.id));await audit("item_quality",before,after);
  }
  if(changed){
   await tx.update(configSets).set({currentRevision:sql`${configSets.currentRevision}+1`}).where(eq(configSets.id,set.id));
   await tx.update(configChangeRequests).set({status:"superseded"}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,["draft","submitted","approved"])));
   await tx.insert(auditLogs).values({action:"config.item.quality.unify",configSetId:set.id,requestId,details:{actorId,changed,legacyMapping:legacyQualityCodes,configSetRevision:set.currentRevision+1}});
  }
  return changed;
 });
}
