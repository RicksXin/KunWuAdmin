import "dotenv/config";
import { readFile,writeFile } from "node:fs/promises";
import { database,databasePool } from "../server/db/client";
import { ResourceService } from "../server/services/resource-service";
import { itemWorkspace,saveItemConfig } from "../server/services/item-config";
import { mutationSchema } from "../server/domain/items/config";
import { and,eq,inArray,sql } from "drizzle-orm";
import { v7 as uuid } from "uuid";
import { configSets,gameAssets,i18nTexts,auditLogs,configEntityRevisions,configChangeRequests } from "../db/schema";
import content from "../server/domain/items/content-v1.json";
async function main(){
 const local=JSON.parse(await readFile(".local/resource-development.json","utf8"));
 const actor=await new ResourceService(databasePool).authenticate(local.adminToken,"admin");
 if(actor.environment!=="development"||!actor.permissions.includes("config.write"))throw Error("需要本地开发配置身份");
 // Import missing resource references, not player balances, into the versioned config set.
 await database.transaction(async tx=>{
  const [set]=await tx.select().from(configSets).where(eq(configSets.code,"v1_0")).for("update");let added=0;
  for(const [code,name,assetType] of [["spiritGrain","灵粮","production_resource"],["spiritWood","灵木","production_resource"],["darkIron","玄铁","production_resource"],["spiritCrystal","灵晶","production_resource"],["gengJing","庚精","production_resource"],["spiritStone","灵石","currency"],["soulCrystal","魂晶","currency"]]){
   const [old]=await tx.select().from(gameAssets).where(and(eq(gameAssets.configSetId,set.id),eq(gameAssets.code,code)));if(old)continue;
   const id=uuid(),requestId=uuid(),nameKey=`resource.${code}.name`;const row={id,configSetId:set.id,code,nameKey,assetType,storageKind:assetType==="currency"?"wallet":"resource",isTradeable:false};
   await tx.insert(gameAssets).values(row);
   await tx.insert(i18nTexts).values({configSetId:set.id,code:nameKey,locale:"zh-CN",text:name}).onDuplicateKeyUpdate({set:{text:name}});
   await tx.insert(configEntityRevisions).values({configSetId:set.id,entityType:"asset",entityId:id,entityCode:code,revision:1,operation:"create",beforeData:null,afterData:row,requestId});
   await tx.insert(auditLogs).values({action:"config.asset.import",entityType:"asset",entityId:id,configSetId:set.id,requestId,details:{actorId:actor.id,source:"34_1.0基础材料与资源循环",code}});added++;
  }
  if(added){await tx.update(configSets).set({currentRevision:sql`${configSets.currentRevision}+1`}).where(eq(configSets.id,set.id));await tx.update(configChangeRequests).set({status:"superseded"}).where(and(eq(configChangeRequests.configSetId,set.id),inArray(configChangeRequests.status,["draft","submitted","approved"])));}
 });
 let workspace=await itemWorkspace("v1_0"),changed=0;
 async function save(raw:unknown){const mutation=mutationSchema.parse(raw);await saveItemConfig("v1_0",mutation,actor.id,crypto.randomUUID(),{adoptExistingAssets:true});changed++;workspace=await itemWorkspace("v1_0");}
 for(const item of content.items){if(!workspace.items.some(i=>i.code===item.code))await save({kind:"item",value:item});}
 // Add provenance to existing five approved-grade ingots without changing names, grades or costs.
 for(const item of workspace.items.filter(i=>i.usageTag==="ingot"&&!i.details.source))await save({kind:"item",value:{...item,isMarketSellable:false,details:{...item.details,source:"Docs/1.0策划案/数值/18_1.0装备与掉落数值_草案.md §6.1；品级采用用户已确认后台配置",description:"原五档铁胚的数量配方，保留后台已确认的新六档品级引用；高阶装备数值不据此自动映射。",contentStatus:"ready"}}});
 if(!workspace.workshop)await save({kind:"workshop",value:{...content.workshop,revision:workspace.workshopRevision}});
 for(const recipe of content.recipes)if(!workspace.recipes.some(r=>r.code===recipe.code))await save({kind:"recipe",value:recipe});
 // Only seed-generated, unchanged planned ingot recipes are promoted after workshop validation.
 for(const recipe of workspace.recipes.filter(r=>r.code.startsWith("rcp_ingot_")&&r.availability==="planned"&&r.revision<=2))await save({kind:"recipe",value:{...recipe,availability:"ready"}});
 if(!workspace.market)await save({kind:"market",value:content.market});
 const byCategory=Object.fromEntries([...new Set(workspace.items.map(i=>i.category))].map(c=>[c,workspace.items.filter(i=>i.category===c).length]));
 const report={configSet:"v1_0",changed,items:workspace.items.length,byCategory,withImages:workspace.items.filter(i=>i.iconPath).map(i=>({code:i.code,name:i.name,path:i.iconPath})),missingImages:workspace.items.filter(i=>!i.iconPath).map(i=>({code:i.code,name:i.name})),planned:workspace.items.filter(i=>i.details.contentStatus==="planned").map(i=>({code:i.code,name:i.name})),recipes:workspace.recipes.length,shopGoods:workspace.market?.goods.length,workshop:!!workspace.workshop};
 await writeFile("Docs/12_物品同步结果.json",JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({changed,items:report.items,byCategory,images:report.withImages.length,missingImages:report.missingImages.length,planned:report.planned.length,recipes:report.recipes,shopGoods:report.shopGoods,workshop:report.workshop}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;}).finally(()=>databasePool.end());
