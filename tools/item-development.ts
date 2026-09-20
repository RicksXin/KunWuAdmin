/** Explicit, repeatable draft initialization. Never publishes or overwrites existing entries. */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { databasePool } from "../server/db/client";
import { itemWorkspace,saveItemConfig } from "../server/services/item-config";
import { ResourceService } from "../server/services/resource-service";
import { migrateItemQualities } from "./item-quality-migration";
import { qualityLevels } from "../server/domain/items/quality";
import { type ItemMutation } from "../server/domain/items/config";
async function main(){
 const set=process.argv[2];if(!set||!/^[a-z0-9][a-z0-9_-]*$/.test(set))throw new Error("用法：pnpm items:setup <配置集编码>");
 const local=JSON.parse(await readFile(".local/resource-development.json","utf8"));
 const actor=await new ResourceService(databasePool).authenticate(local.adminToken,"admin");
 if(actor.environment!=="development"||!actor.permissions.includes("config.write"))throw new Error("开发管理身份没有配置权限");
 const migrated=await migrateItemQualities(set,actor.id);
 if(process.argv.includes("--qualities-only")){console.log(`ITEM_QUALITY_MIGRATION_OK set=${set} changed=${migrated}`);return;}
 let workspace=await itemWorkspace(set);let created=0;
 async function save(m:ItemMutation){const collection=m.kind==="scheme"?workspace.schemes:m.kind==="quality"?workspace.qualities:m.kind==="item"?workspace.items:m.kind==="recipe"?workspace.recipes:[];if(m.kind!=="workshop"&&collection.some(r=>r.code===m.value.code))return;await saveItemConfig(set,m,actor.id,crypto.randomUUID());created++;workspace=await itemWorkspace(set);}
 const common={revision:0,status:"active" as const,sortOrder:0};
 const ingots=[['common','法器',1,8,0],['refined','真宝',7,18,0],['superior','法宝',12,36,1],['precious','古宝',16,70,4],['magic','通天灵宝',23,130,12]] as const;
 for(const [i,[code,name,level,iron,geng]] of ingots.entries()){
  await save({kind:"item",value:{...common,code:`ingot_${code}`,name:`${name}铁胚`,category:"processed",usageTag:"ingot",qualityCode:qualityLevels[i].code,stackLimit:9999,iconPath:"",isProtected:false,isDiscardable:true,sortOrder:i}});
  await save({kind:"recipe",value:{...common,code:`rcp_ingot_${code}`,name:`炼制${name}铁胚`,availability:"planned",workshopLevel:level,outputCode:`ingot_${code}`,outputQuantity:1,costs:[{kind:"resource",code:"darkIron",quantity:iron},...(geng?[{kind:"resource" as const,code:"gengJing",quantity:geng}]:[])],sortOrder:i}});
 }
 console.log(`ITEM_DRAFT_SETUP_OK set=${set} created=${created} migrated=${migrated}; recipes remain planned; no release published`);
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;}).finally(()=>databasePool.end());
