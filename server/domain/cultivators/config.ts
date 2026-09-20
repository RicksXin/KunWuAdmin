import { z } from "zod";
export const attributes=["strength","magic","technique","speed","constitution","armor","resistance"] as const;
export const attributeNames:Record<string,string>={strength:"力道",magic:"法力",technique:"神识",speed:"遁速",constitution:"肉身",armor:"护体",resistance:"定力"};
const code=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/).max(96);
const positive=z.number().int().min(1).max(100000000);
const amount=z.number().int().min(0).max(1000000);
const common={code,name:z.string().trim().min(1).max(80),revision:z.number().int().nonnegative(),status:z.enum(["active","disabled"]),sortOrder:z.number().int().min(0).max(100000)};
export const statsSchema=z.object({strength:amount,magic:amount,technique:amount,speed:amount,constitution:amount,armor:amount,resistance:amount}).strict();
export const careerSchema=z.object({...common,tier:z.number().int().min(0).max(2),primaryAttribute:z.enum(attributes),baseHp:positive,base:statsSchema,growth:statsSchema,skills:z.array(z.object({code,unlockLevel:z.number().int().min(1).max(60),auto:z.boolean()}).strict()).max(3)}).strict().refine(v=>new Set(v.skills.map(s=>s.code)).size===v.skills.length,"技能不能重复");
export const rootSchema=z.object({...common,basePercent:z.number().int().min(1).max(1000),growthPercent:z.number().int().min(1).max(1000),rarityOrder:z.number().int().min(0).max(100)}).strict();
export const realmSchema=z.object({...common,orderIndex:z.number().int().min(0).max(100),minLevel:z.number().int().min(1).max(60),maxLevel:z.number().int().min(1).max(60),breakthroughLevel:z.number().int().min(1).max(60).nullable(),breakthroughRecipeCode:code.nullable()}).strict().refine(v=>v.minLevel<=v.maxLevel,"境界起始等级不能超过结束等级").refine(v=>v.breakthroughLevel===null||v.breakthroughLevel===v.maxLevel,"突破门槛应等于境界最高等级");
export const neutralGrowth={strength:1000,magic:1000,technique:1000,speed:1000,constitution:1000,armor:1000,resistance:1000};
export const heroSchema=z.object({...common,templateClass:z.enum(["common","excellent"]).default("common"),acquisitionWeight:z.number().int().min(0).max(100000).default(0),appearanceCode:code.default("legacy"),namePool:z.array(z.string().trim().min(1).max(40)).min(1).max(100).refine(v=>new Set(v).size===v.length,"姓名池不能重复").default(["无名"]),growthFocus:z.string().trim().max(120).default(""),growthModifiers:statsSchema.default(neutralGrowth),careerCode:code,rootCode:code,realmCode:code,initialLevel:z.number().int().min(1).max(60),portraitAssetKey:z.string().max(512).regex(/^(?:$|[a-zA-Z0-9_./:-]+)$/)}).strict();
export const routeSchema=z.object({...common,initialCareerCode:code,foundationCareerCode:code,coreCareerCode:code,foundationTrial:code,coreTrial:code,coreBonus:statsSchema}).strict().refine(v=>new Set([v.initialCareerCode,v.foundationCareerCode,v.coreCareerCode]).size===3,"职业路线三个阶段不能重复");
export const rulesSchema=z.object({
 code:z.literal("default"),revision:z.number().int().nonnegative(),maxLevel:z.literal(30),
 fixedRoster:z.array(code).length(4),fixedNames:z.array(z.string().trim().max(40)).length(4).default(["","","",""]),levelCosts:z.array(positive).length(29),
 spiritMax:z.number().int().min(1).max(10000),spiritRecoverySeconds:z.number().int().min(1).max(86400),
 foundationStone:positive,coreStone:positive,coreDiscount:z.number().int().min(0).max(100000000),corePillCode:code,
 foundationQuest:code,coreQuest:code,discountQuest:code,
 foundationResetStone:positive,coreResetStone:positive,
 revive:z.array(z.object({realmCode:code,base:amount,perLevel:positive,offset:z.number().int().min(0).max(60)}).strict()).length(3),
}).strict().superRefine((v,c)=>{
 if(new Set(v.revive.map(r=>r.realmCode)).size!==3)c.addIssue({code:"custom",path:["revive"],message:"还魂境界不能重复"});
 if(v.coreDiscount>=v.coreStone)c.addIssue({code:"custom",path:["coreDiscount"],message:"结丹优惠必须小于基础灵石费用"});
 if(v.levelCosts.some((cost,i)=>i>0&&cost<v.levelCosts[i-1]))c.addIssue({code:"custom",path:["levelCosts"],message:"升级费用不能递减"});
});
export const mutationSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("hero"),value:heroSchema}),z.object({kind:z.literal("career"),value:careerSchema}),
 z.object({kind:z.literal("root"),value:rootSchema}),z.object({kind:z.literal("realm"),value:realmSchema}),
 z.object({kind:z.literal("route"),value:routeSchema}),z.object({kind:z.literal("rules"),value:rulesSchema}),
]);
export type CultivatorMutation=z.input<typeof mutationSchema>;
export type Rules=z.infer<typeof rulesSchema>;
export type Catalog={heroes:z.infer<typeof heroSchema>[];careers:z.infer<typeof careerSchema>[];roots:z.infer<typeof rootSchema>[];realms:z.infer<typeof realmSchema>[];routes:z.infer<typeof routeSchema>[];rules:Rules|null;skills:{code:string;name:string;status:string}[]};
export const defaultLevelCosts=[20,25,30,35,45,55,70,85,105,130,150,175,200,230,265,305,350,400,455,520,590,670,760,860,975,1100,1240,1395,1565];
export function validateCultivators(c:Catalog,publishing=false):string[]{
 const errors:string[]=[],active=(r:{status:string})=>r.status==="active";
 const career=(code:string)=>c.careers.find(r=>r.code===code&&active(r));
 const realm=(code:string)=>c.realms.find(r=>r.code===code&&active(r));
 for(const h of c.heroes.filter(active)){
  if(!career(h.careerCode))errors.push(`${h.code}：职业不存在或已停用`);
  if(!c.roots.some(r=>r.code===h.rootCode&&active(r)))errors.push(`${h.code}：灵根不存在或已停用`);
  const r=realm(h.realmCode);if(!r||h.initialLevel<r.minLevel||h.initialLevel>r.maxLevel)errors.push(`${h.code}：初始等级不在所选境界范围`);
 }
 for(const row of c.careers.filter(active)){
  for(const s of row.skills)if(!c.skills.some(x=>x.code===s.code&&active(x)))errors.push(`${row.code}：技能 ${s.code} 不存在或已停用`);
  if(publishing&&c.rules&&row.skills.length!==3)errors.push(`${row.code}：需要恰好三个阶段技能`);
  if(publishing&&c.rules&&row.skills.some(s=>s.unlockLevel>row.tier*10+1))errors.push(`${row.code}：阶段开始时三个技能须全部解锁`);
 }
 const ranges=c.realms.filter(active).sort((a,b)=>a.minLevel-b.minLevel);
 for(let i=1;i<ranges.length;i++)if(ranges[i].minLevel<=ranges[i-1].maxLevel)errors.push("境界等级范围不能重叠");
 for(const route of c.routes.filter(active)){
  const steps=[career(route.initialCareerCode),career(route.foundationCareerCode),career(route.coreCareerCode)];
  if(steps.some((r,i)=>!r||r.tier!==i))errors.push(`${route.code}：路线职业需对应炼气、筑基、结丹阶段`);
  if(publishing&&steps[1]&&steps[2]&&steps[1].skills.map(s=>s.code).join()!==steps[2].skills.map(s=>s.code).join())errors.push(`${route.code}：结丹须保留筑基三个技能`);
 }
 if(c.rules){
  for(const code of c.rules.fixedRoster)if(!c.heroes.some(h=>h.code===code&&active(h)))errors.push(`初始修士 ${code} 未配置或已停用`);
  for(const cost of c.rules.revive){const r=realm(cost.realmCode);if(!r)errors.push(`还魂境界 ${cost.realmCode} 不存在`);else if(cost.offset>r.minLevel||cost.base+cost.perLevel*(r.minLevel-cost.offset)<=0)errors.push(`还魂境界 ${cost.realmCode} 费用必须为正`);}
 }
 if(publishing&&c.rules){
  const r=c.rules;

  const expected=[[1,10],[11,20],[21,30]];
  if(ranges.length!==3||ranges.some((x,i)=>x.minLevel!==expected[i]?.[0]||x.maxLevel!==expected[i]?.[1]))errors.push("1.0境界须完整覆盖炼气1–10、筑基11–20、结丹21–30");

  for(const h of c.heroes.filter(h=>r.fixedRoster.includes(h.code))){
   if(h.initialLevel!==1||career(h.careerCode)?.tier!==0)errors.push(`${h.code}：固定初始修士需从炼气1级开始`);
   if(c.routes.filter(x=>active(x)&&x.initialCareerCode===h.careerCode).length!==2)errors.push(`${h.code}：筑基路线应有两个分支`);
  }
  const branches=c.routes.filter(active).map(x=>x.foundationCareerCode);
  const cores=c.routes.filter(active).map(x=>x.coreCareerCode);
  if(new Set(branches).size!==branches.length||new Set(cores).size!==cores.length)errors.push("职业分支或结丹目标不能在多条路线中重复");
 }
 return [...new Set(errors)];
}

/** Pick once when creating an instance; store the returned name on that instance. */
export function chooseCultivatorName(pool:readonly string[],fixedName="",random=Math.random):string{
 if(fixedName.trim())return fixedName.trim();
 if(!pool.length)throw new Error("姓名池不能为空");
 const value=random();if(value<0||value>=1||!Number.isFinite(value))throw new Error("随机值需在 [0,1) 范围");
 return pool[Math.floor(value*pool.length)];
}
/** Unrounded per-level points; round only after accumulating the growth segment. */
export function templateGrowth(careerGrowth:number,modifier:number,rootPercent:number):number{
 return careerGrowth/1000*modifier/1000*rootPercent/100;
}

/** Default channel only: choose a career first, then normalize its enabled template weights. */
export function templateProbabilities(heroes:Catalog["heroes"],careerCode:string){
 const pool=heroes.filter(h=>h.status==="active"&&h.careerCode===careerCode&&h.acquisitionWeight>0);
 const total=pool.reduce((n,h)=>n+h.acquisitionWeight,0);
 return pool.map(h=>({code:h.code,probability:h.acquisitionWeight/total}));
}

export const probabilityUpdateSchema=z.object({
 revision:z.number().int().nonnegative(),careerCode:code,
 entries:z.array(z.object({code,basisPoints:z.number().int().min(0).max(10000)}).strict()).min(1).max(200),
}).strict().superRefine((v,c)=>{
 if(new Set(v.entries.map(e=>e.code)).size!==v.entries.length)c.addIssue({code:"custom",message:"模板不能重复"});
 if(v.entries.reduce((n,e)=>n+e.basisPoints,0)!==10000)c.addIssue({code:"custom",message:"同职业模板概率合计必须为100%"});
});
/** Largest remainder preserves the existing distribution at 0.01% precision. */
export function probabilityBasisPoints(heroes:Catalog["heroes"],careerCode:string){
 const rows=heroes.filter(h=>h.status==="active"&&h.careerCode===careerCode);
 const total=rows.reduce((n,h)=>n+h.acquisitionWeight,0);
 const entries=rows.map(h=>({code:h.code,basisPoints:total?Math.floor(h.acquisitionWeight/total*10000):0,remainder:total?(h.acquisitionWeight/total*10000)%1:0}));
 if(total){const order=[...entries].sort((a,b)=>b.remainder-a.remainder);const left=10000-entries.reduce((n,e)=>n+e.basisPoints,0);for(let i=0;i<left;i++)order[i].basisPoints++;}
 return entries.map(({code,basisPoints})=>({code,basisPoints}));
}
