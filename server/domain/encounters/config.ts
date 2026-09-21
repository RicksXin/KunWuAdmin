import { z } from "zod";
const code=z.string().regex(/^[a-z][a-z0-9_]*$/);
const source=z.object({document:z.string().min(1),section:z.string().min(1),text:z.string().min(1)}).strict();
export const enemyDesignSchema=z.object({
  schemaVersion:z.literal(1),implementationStatus:z.enum(["design_only","runtime_ready"]),mapNumber:z.number().int().min(1).max(4),
  role:z.string().min(1),hardControl:z.boolean(),healer:z.boolean(),source,
  intendedCounterplay:z.string().min(1),
  proposedBaseIntervalTicks:z.number().int().min(1).nullable(),
  proposals:z.array(z.string()),
}).strict();
export const encounterDesignSchema=z.object({
  schemaVersion:z.literal(1),implementationStatus:z.enum(["design_only","runtime_ready"]),mapNumber:z.number().int().min(1).max(4),
  region:z.string().min(1),difficulty:z.enum(["low","medium","high","elite","boss"]),
  recommendedLevel:z.number().int().min(1).max(30),targetSeconds:z.tuple([z.number().int().positive(),z.number().int().positive()]),
  sequence:z.number().int().positive(),members:z.array(z.object({enemyCode:code,quantity:z.number().int().min(1).max(4)}).strict()).min(1),
  firstSoulCrystal:z.number().int().min(0),repeatSoulCrystal:z.number().int().min(0),rewardBasis:z.enum(["new_design","source_19"]),
  additionalRewards:z.string(),rewardState:z.enum(["pending_asset_and_quality_mapping","runtime_package"]),
  refresh:z.enum(["next_expedition","never"]),firstClearOnce:z.literal(true),revisitRetainsFirstClear:z.literal(true),
  mainBossOrdinal:z.number().int().min(1).max(4).nullable(),bossSoulCode:code.nullable(),
  intent:z.string().min(1),precondition:z.string(),source:z.string().min(1),coordinateStatus:z.enum(["unplaced","bound"]),
}).strict();
export type EnemyDesign=z.infer<typeof enemyDesignSchema>;
export type EncounterDesign=z.infer<typeof encounterDesignSchema>;
export type EnemyContent={code:string;name:string;rank:"normal"|"elite"|"boss";level:number;maxHp:number;stats:number[];design:EnemyDesign};
export type EncounterContent={code:string;name:string;design:EncounterDesign};
export function validateBattleDesign(enemies:EnemyContent[],encounters:EncounterContent[]){
  const errors:string[]=[];
  const byCode=new Map(enemies.map(e=>[e.code,e]));
  if(byCode.size!==enemies.length)errors.push("敌人code重复");
  if(new Set(encounters.map(e=>e.code)).size!==encounters.length)errors.push("遭遇code重复");
  for(const enemy of enemies){
    if(!enemyDesignSchema.safeParse(enemy.design).success)errors.push(`${enemy.code} 设计格式错误`);
    if(enemy.stats.length!==7||enemy.stats.some(s=>!Number.isSafeInteger(s)||s<0)||enemy.maxHp<=0)errors.push(`${enemy.code} 属性非法`);
  }
  for(const encounter of encounters){
    const d=encounter.design;
    if(!encounterDesignSchema.safeParse(d).success){errors.push(`${encounter.code} 设计格式错误`);continue;}
    let count=0,control=0,healers=0;
    for(const m of d.members){
      const enemy=byCode.get(m.enemyCode);
      if(!enemy||enemy.design.mapNumber!==d.mapNumber){errors.push(`${encounter.code} 敌人引用缺失或跨图`);continue;}
      count+=m.quantity;if(enemy.design.hardControl)control+=m.quantity;if(enemy.design.healer)healers+=m.quantity;
    }
    if(["low","medium","high"].includes(d.difficulty)&&(count>4||control>1||healers>1))errors.push(`${encounter.code} 超过普通敌群人数/硬控/恢复上限`);
    if(d.difficulty==="boss"&&(d.refresh!=="never"||d.repeatSoulCrystal!==0))errors.push(`${encounter.code} 主线Boss不能刷新奖励`);
    if(d.repeatSoulCrystal>d.firstSoulCrystal)errors.push(`${encounter.code} 重复奖励不能高于首次`);
    const shouldHaveSoul=d.mainBossOrdinal===2||d.mainBossOrdinal===4;
    if(Boolean(d.bossSoulCode)!==shouldHaveSoul)errors.push(`${encounter.code} Boss魂魄序位不符`);
    if(d.targetSeconds[0]>d.targetSeconds[1])errors.push(`${encounter.code} 时长范围非法`);
  }
  return errors;
}
