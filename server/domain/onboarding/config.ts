import { z } from "zod";
import { createFarm,type FarmState } from "../resources/settle";
import { currentRulesSchema,type ProductionRules } from "../resources/rules";

export const onboardingConfig={schemaVersion:1,initialBuildings:["yi_shi_dian"],unlock:{sceneCode:"P0-01",npcCode:"npc_cen_shouyi",buildingCode:"ling_pu",level:1,onceKey:"onboarding.ling_pu.unlocked"},initialFarmPolicy:"resource_service_createFarm",autoAssignWorkers:false} as const;
export const onboardingSchema=z.object({schemaVersion:z.literal(1),initialBuildings:z.tuple([z.literal("yi_shi_dian")]),unlock:z.object({sceneCode:z.literal("P0-01"),npcCode:z.literal("npc_cen_shouyi"),buildingCode:z.literal("ling_pu"),level:z.literal(1),onceKey:z.literal("onboarding.ling_pu.unlocked")}).strict(),initialFarmPolicy:z.literal("resource_service_createFarm"),autoAssignWorkers:z.literal(false)}).strict();
export type OnboardingState={buildingLevels:Record<string,number>;completedClaims:string[];farm:FarmState|null};
export function initialCamp(buildingCodes:string[]):OnboardingState{
  return {buildingLevels:Object.fromEntries([...new Set(["yi_shi_dian",...buildingCodes])].map(code=>[code,code==="yi_shi_dian"?1:0])),completedClaims:[],farm:null};
}
/** Pure transaction transition. Call only after a trusted dialogue completion, then persist atomically. */
export function completeCampDialogue(state:OnboardingState,event:{sceneCode:string;npcCode:string},now:number,rules:ProductionRules):OnboardingState{
  if(event.sceneCode!==onboardingConfig.unlock.sceneCode||event.npcCode!==onboardingConfig.unlock.npcCode)return state;
  if(state.completedClaims.includes(onboardingConfig.unlock.onceKey))return state;
  if(!Number.isSafeInteger(now)||now<0)throw new Error("解锁时间无效");
  const validated=currentRulesSchema.parse(rules);
  return {...state,buildingLevels:{...state.buildingLevels,ling_pu:Math.max(1,state.buildingLevels.ling_pu??0)},completedClaims:[...state.completedClaims,onboardingConfig.unlock.onceKey],farm:state.farm??createFarm(now,validated)};
}
