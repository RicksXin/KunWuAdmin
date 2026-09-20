import { z } from "zod";
const code=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/).max(96);
const integer=z.number().int().min(0).max(100000000);
export const marketSchema=z.object({
 playerSellingEnabled:z.literal(false).default(false),buybackEnabled:z.literal(false).default(false),offlineRefreshPolicy:z.literal("latest_batch_only").default("latest_batch_only"),manualRefreshResetsClock:z.literal(false).default(false),resourceTypeSelection:z.literal("equal_unlocked").default("equal_unlocked"),blueprintsUniquePerBatch:z.literal(true).default(true),ownedBlueprintsExcluded:z.literal(true).default(true),code:z.literal("default"),revision:integer,currency:z.literal("spiritStone"),
 refreshSeconds:z.number().int().min(1).max(604800),randomSlots:z.number().int().min(1).max(30),refreshBase:integer,refreshPerMap:integer,
 currentTierPercent:z.number().int().min(0).max(100),
 groups:z.array(z.object({code,name:z.string().min(1).max(80),weight:integer,minMap:z.number().int().min(1).max(16),stockMin:z.number().int().min(1),stockMax:z.number().int().min(1),prices:z.array(integer).length(4),availability:z.enum(["ready","planned"])}).strict()).max(20),
 goods:z.array(z.object({code,itemCode:code,shelf:z.enum(["fixed","random"]),groupCode:code.nullable(),price:z.number().int().min(1).max(100000000),stock:z.number().int().min(1).max(100000),minMap:z.number().int().min(1).max(16),tier:z.number().int().min(1).max(4).nullable(),enabled:z.boolean()}).strict()).max(200),
}).strict().superRefine((v,c)=>{
 if(new Set(v.goods.map(g=>g.code)).size!==v.goods.length)c.addIssue({code:"custom",message:"商品编码不能重复"});
 if(new Set(v.groups.map(g=>g.code)).size!==v.groups.length)c.addIssue({code:"custom",message:"随机组不能重复"});
 if(v.groups.some(g=>g.stockMin>g.stockMax))c.addIssue({code:"custom",message:"库存下限不能超过上限"});
 if(!v.groups.some(g=>g.weight>0))c.addIssue({code:"custom",message:"至少一个随机组权重大于0"});
 for(const g of v.goods)if(g.shelf==="random"&&!v.groups.some(x=>x.code===g.groupCode))c.addIssue({code:"custom",message:`${g.code}随机组不存在`});
});
