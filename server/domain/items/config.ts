import { marketSchema } from "./market";
import { z } from "zod";
import { qualityLevels, unifiedQualityScheme } from "./quality";
const code = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/).max(96);
const count = z.number().int().min(1).max(2147483647);
const common = { code, revision: z.number().int().nonnegative(), status: z.enum(["active", "disabled"]), sortOrder: z.number().int().min(0).max(100000), name: z.string().trim().min(1).max(80) };
export const categories = ["material", "processed", "consumable", "food", "resource_pack", "quest", "equipment", "rune", "blueprint"] as const;
export const categoryNames: Record<string,string> = {equipment:"装备",rune:"器纹",blueprint:"蓝图",material:"材料",processed:"加工品",consumable:"消耗品",food:"食物",resource_pack:"资源包",quest:"任务物品"};
export const schemeSchema = z.object({...common,code:z.literal("unified"),name:z.literal("统一品级"),category:z.literal("all"),usageTag:z.literal("all"),status:z.literal("active"),sortOrder:z.literal(0)}).strict();
export const qualitySchema = z.object({...common,code:code.max(32),schemeCode:z.literal("unified"),status:z.literal("active"),color:z.string().regex(/^#[0-9a-fA-F]{6}$/, "颜色需为 #RRGGBB")}).strict().superRefine((v,c)=>{
  const level=qualityLevels.find(q=>q.code===v.code);
  if(!level||v.name!==level.name||v.sortOrder!==level.sortOrder)c.addIssue({code:"custom",path:["code"],message:"品级固定为法器、真宝、法宝、古宝、通天灵宝、玄天之宝，不可新增或更改顺序"});
});
export const itemDetailsSchema=z.object({source:z.string().max(512).default(""),description:z.string().max(6000).default(""),weight:z.number().int().min(0).nullable().default(null),holdLimit:z.number().int().min(1).nullable().default(null),resourceCode:code.nullable().default(null),resourceYield:z.number().int().min(1).nullable().default(null),packTier:z.enum(["low","high","special","immortal"]).nullable().default(null),usageScope:z.string().max(200).default(""),attribute:code.nullable().default(null),contentStatus:z.enum(["ready","planned"]).default("planned")}).strict();
export const itemSchema = z.object({...common, details:itemDetailsSchema.default(()=>itemDetailsSchema.parse({})), category:z.enum(categories), usageTag: code.max(48), qualityCode:code.max(32).nullable(), stackLimit:count, iconPath:z.string().max(512).regex(/^(?:$|(?:res:\/\/|\/)[a-zA-Z0-9_./-]+$)/,"图标需为资源路径"), isMarketSellable:z.boolean().default(false), isProtected:z.boolean(), isDiscardable:z.boolean()}).strict().superRefine((v,c)=>{
  if((v.details.resourceCode===null)!==(v.details.resourceYield===null))c.addIssue({code:"custom",path:["details"],message:"资源效果需要同时配置资源编码和数量"});
  if(v.details.packTier!==null&&v.category!=="resource_pack")c.addIssue({code:"custom",path:["details"],message:"包装档位仅用于资源包"});
  if(v.isMarketSellable&&(v.isProtected||v.category==="quest"))c.addIssue({code:"custom",path:["isMarketSellable"],message:"受保护物品和任务物品不可在交易行售卖"});
  if(v.qualityCode && !qualityLevels.some(q=>q.code===v.qualityCode))c.addIssue({code:"custom",path:["qualityCode"],message:"请选择六个统一品级之一"});
  if((v.isProtected || v.category === "quest") && v.isDiscardable)c.addIssue({code:"custom",path:["isDiscardable"],message:"受保护物品和任务物品不可丢弃"});
  if(v.category === "quest" && !v.isProtected)c.addIssue({code:"custom",path:["isProtected"],message:"任务物品必须受保护"});
});
export const costSchema = z.object({kind:z.enum(["resource","item","currency"]),code,quantity:count}).strict();
export type CraftCost = z.infer<typeof costSchema>;
export const recipeSchema = z.object({...common,availability:z.enum(["ready","planned"]),workshopLevel:z.number().int().min(1).max(24),outputCode:code,outputQuantity:count,outcomes:z.array(z.object({code,quantity:count,weight:count}).strict()).max(20).default([]),costs:z.array(costSchema).min(1).max(20)}).strict().superRefine((v,c)=>{
  if(v.availability==="ready"&&v.outcomes.length)c.addIssue({code:"custom",path:["availability"],message:"随机产出执行器未接入，配方只能待定"});
  if(new Set(v.outcomes.map(o=>o.code)).size!==v.outcomes.length)c.addIssue({code:"custom",path:["outcomes"],message:"随机结果不能重复"});
  if(new Set(v.costs.map(x=>`${x.kind}:${x.code}`)).size!==v.costs.length)c.addIssue({code:"custom",path:["costs"],message:"同一消耗项不能重复"});
  if(v.costs.some(x=>x.code===v.outputCode))c.addIssue({code:"custom",path:["costs"],message:"产物不能作为自身配方消耗"});
  if(v.availability==="ready" && v.costs.some(x=>x.kind==="currency"))c.addIssue({code:"custom",path:["availability"],message:"货币账户接入前，涉及灵石的配方只能待定"});
});
export const workshopSchema = z.object({revision:z.number().int().nonnegative(),woodCode:code,costs:z.array(count).length(23)}).strict().superRefine((v,c)=>{
  if(v.costs.some((x,i)=>i>0&&x<=v.costs[i-1]))c.addIssue({code:"custom",path:["costs"],message:"升级消耗必须逐级递增"});
});
export const mutationSchema = z.discriminatedUnion("kind",[
  z.object({kind:z.literal("scheme"),value:schemeSchema}),z.object({kind:z.literal("quality"),value:qualitySchema}),
  z.object({kind:z.literal("item"),value:itemSchema}),z.object({kind:z.literal("recipe"),value:recipeSchema}),
  z.object({kind:z.literal("workshop"),value:workshopSchema}),z.object({kind:z.literal("market"),value:marketSchema}),
]);
export type ItemMutation = z.input<typeof mutationSchema>;
export type ItemConfig = z.infer<typeof itemSchema>;
export type QualityConfig = z.infer<typeof qualitySchema>;
export type SchemeConfig = z.infer<typeof schemeSchema>;
export type RecipeConfig = z.infer<typeof recipeSchema>;
export type Catalog = {market?:z.infer<typeof marketSchema>|null;items:ItemConfig[];qualities:QualityConfig[];schemes:SchemeConfig[];recipes:RecipeConfig[];assets:{code:string;assetType:string;status:string}[];workshop:z.infer<typeof workshopSchema>|null};

/** Validate the whole draft so disabling a referenced row cannot bypass checks. */
export function validateCatalog(c: Catalog): string[] {
  const errors:string[]=[];
  if(c.qualities.length && (c.qualities.length!==6 || new Set(c.qualities.map(q=>q.code)).size!==6))errors.push("品级必须恰好包含六个统一等级");
  const active=(s:{status:string})=>s.status==="active";
  for(const q of c.qualities) {
    if(!qualitySchema.safeParse(q).success)errors.push(`${q.code}：品级必须使用固定六档`);
    if(!c.schemes.some(s=>s.code===q.schemeCode&&active(s)))errors.push(`${q.code}：品级方案不存在或已停用`);
  }
  for(const item of c.items.filter(active)) {
    const parsed=itemSchema.safeParse(item);if(!parsed.success)errors.push(`${item.code}：${parsed.error.issues.map(i=>i.message).join("；")}`);
    if(item.details.resourceCode&&!c.assets.some(a=>a.code===item.details.resourceCode&&active(a)))errors.push(`${item.code}：使用效果引用的资源不存在或已停用`);
    if(!item.qualityCode)continue;
    const q=c.qualities.find(q=>q.code===item.qualityCode&&active(q));
    const scheme=q&&c.schemes.find(s=>s.code===q.schemeCode&&active(s));
    if(!scheme || scheme.code!==unifiedQualityScheme.code)errors.push(`${item.code}：请选择启用的统一品级`);
  }
  if(c.market){
   if(!c.assets.some(a=>a.code===c.market!.currency&&a.assetType==="currency"&&active(a)))errors.push("系统商店缺少启用的灵石货币定义");
   for(const group of c.market.groups.filter(g=>g.availability==="ready"))if(!c.market.goods.some(g=>g.enabled&&g.shelf==="random"&&g.groupCode===group.code))errors.push(`${group.name}：已就绪随机组缺少启用商品`);
   for(const g of c.market.goods.filter(g=>g.enabled)){
    const item=c.items.find(i=>i.code===g.itemCode&&i.status==="active");
    if(!item||item.isProtected||["quest","equipment"].includes(item.category))errors.push(`${g.code}：系统商店商品引用无效、受保护或为装备成品`);
  }}
  for(const r of c.recipes.filter(r=>active(r)&&r.availability==="ready")) {
    if(!c.workshop)errors.push(`${r.code}：请先配置炼器坊等级消耗`);
    if(!c.items.some(i=>i.code===r.outputCode&&active(i)))errors.push(`${r.code}：产物不存在或已停用`);
    for(const cost of r.costs) {
      const asset=c.assets.find(a=>a.code===cost.code&&active(a));
      const ok=cost.kind==="item" ? c.items.some(i=>i.code===cost.code&&active(i)) : cost.kind==="resource" && asset && ["resource","production_resource"].includes(asset.assetType) && cost.code!=="spiritStone";
      if(!ok)errors.push(`${r.code}：消耗项 ${cost.code} 不存在、类型不符或尚未接入`);
    }
  }
  if(c.workshop && !c.assets.some(a=>a.code===c.workshop!.woodCode&&["resource","production_resource"].includes(a.assetType)&&a.code==="spiritWood"&&active(a)))errors.push("炼器坊：升级资源不存在或已停用");
  return errors;
}
