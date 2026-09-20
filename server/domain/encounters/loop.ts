import {z} from 'zod';
const code=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/);
const attrs=['strength','magic','technique','speed','constitution','armor','resistance'] as const;
const attribute=z.enum(attrs);
const positive=z.number().int().positive();
const equipmentSchema=z.object({schemaVersion:z.literal(1),capacity:positive,qualityNames:z.record(z.string(),z.string()),qualityMultipliers:z.object({fa_qi:positive,zhen_bao:positive}).strict(),pool:z.array(code).min(1),templates:z.array(z.object({code,name:z.string(),slot:z.enum(['weapon','armor','accessory']),baseStatBudget:positive,runeSlots:z.number().int().min(1).max(2),allowedStats:z.array(attribute).min(1),careers:z.array(z.enum(['wu_xiu','fa_xiu','yi_xiu','qian_xiu']))}).strict()).min(1)}).strict();
const loot=z.object({itemId:code,name:z.string().optional(),amount:positive}).strict();
const rewards=z.array(z.object({qualityCode:z.enum(['fa_qi','zhen_bao']),quantity:positive}).strict());
const encounter=z.object({id:code,designCode:code.optional(),escapeEnemyHpPercent:z.number().int().min(0).max(100),firstSoulCrystalReward:z.number().int().nonnegative(),repeatSoulCrystalReward:z.number().int().nonnegative(),members:z.array(z.object({enemyId:code,quantity:positive}).strict()).min(1),loot:z.array(loot),firstLoot:z.array(loot).optional(),equipmentRewards:rewards.optional(),mainBossOrdinal:positive.optional(),firstVictoryEffects:z.record(z.string(),z.unknown()).optional(),victoryEffects:z.record(z.string(),z.unknown()).optional()}).strict();
export const map01LoopSchema=z.object({schemaVersion:z.literal(1),mapId:z.literal('map_01'),encounterBindings:z.record(code,code),combat:z.object({schemaVersion:z.literal(1),status:z.string(),inherits:z.literal('res://data/config/combat_d0.json'),skills:z.array(z.record(z.string(),z.unknown())),enemyTemplates:z.array(z.record(z.string(),z.unknown())),encounters:z.array(encounter)}).strict(),equipment:equipmentSchema,settlement:z.object({materialLossBasisPoints:z.literal(3000),equipmentLossBasisPoints:z.literal(3000),protectedItemCodes:z.array(code)}).strict(),notes:z.string()}).strict().superRefine((value,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:'custom',message});
 const enemyCodes=new Set(value.combat.enemyTemplates.map(e=>e.id));
 const skillCodes=new Set(value.combat.skills.map(s=>s.id));
 if(enemyCodes.size!==8||value.combat.enemyTemplates.length!==8||skillCodes.size!==14||value.combat.skills.length!==14)fail('地图1需要8种敌人和14个技能');
 for(const e of value.combat.enemyTemplates){if(!Array.isArray(e.skillIds)||e.skillIds.some(id=>!skillCodes.has(id)))fail('敌人技能引用缺失');}
 const encounterCodes=new Set(value.combat.encounters.map(e=>e.id));
 if(encounterCodes.size!==14||value.combat.encounters.length!==14)fail('地图1需要14个唯一遭遇入口');
 if(Object.keys(value.encounterBindings).length!==13||new Set(Object.values(value.encounterBindings)).size!==13)fail('需要13个唯一设计绑定');
 for(const id of Object.values(value.encounterBindings))if(!encounterCodes.has(id))fail('绑定入口缺失');
 for(const e of value.combat.encounters){if(e.members.some(m=>!enemyCodes.has(m.enemyId))||e.members.reduce((a,m)=>a+m.quantity,0)>4)fail('敌群引用或数量非法');if(e.repeatSoulCrystalReward>e.firstSoulCrystalReward)fail('重复奖励大于首杀');}
 const boss=value.combat.encounters.find(e=>e.id==='m1_boss_gate_spirit');
 if(!boss||boss.repeatSoulCrystalReward!==0||JSON.stringify(boss.equipmentRewards)!==JSON.stringify([{qualityCode:'fa_qi',quantity:1},{qualityCode:'zhen_bao',quantity:1}]))fail('Boss奖励必须为法器1件、真宝1件且不重复');
 if(new Set(value.equipment.templates.map(t=>t.code)).size!==value.equipment.templates.length)fail('装备模板重复');
 for(const id of value.equipment.pool)if(!value.equipment.templates.some(t=>t.code===id))fail('装备池引用缺失');
});
export type Map01Loop=z.infer<typeof map01LoopSchema>;
