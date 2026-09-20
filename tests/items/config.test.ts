import { qualityLevels, unifiedQualityScheme } from "../../server/domain/items/quality";
import test from "node:test";
import assert from "node:assert/strict";
import { itemSchema, recipeSchema, qualitySchema, workshopSchema, validateCatalog, type Catalog } from "../../server/domain/items/config";
const base={code:"test",name:"测试",revision:0,status:"active" as const,sortOrder:0};
const recipe={...base,availability:"ready",workshopLevel:1,outputCode:"ingot",outputQuantity:1,costs:[{kind:"resource",code:"darkIron",quantity:8}]};
test("配方拒绝零成本、重复成本、自引用、未接入货币和超范围等级",()=>{
  assert.ok(recipeSchema.safeParse(recipe).success);
  for(const patch of [{costs:[]},{costs:[{kind:"resource",code:"darkIron",quantity:0}]},{costs:[recipe.costs[0],recipe.costs[0]]},{outputCode:"darkIron"},{costs:[{kind:"currency",code:"spiritStone",quantity:10}]},{workshopLevel:25}])assert.equal(recipeSchema.safeParse({...recipe,...patch}).success,false);
});
test("任务保护、颜色和升级递增约束",()=>{
  assert.equal(itemSchema.safeParse({...base,category:"quest",usageTag:"quest",qualityCode:null,stackLimit:1,iconPath:"",isProtected:true,isDiscardable:true}).success,false);
  assert.equal(qualitySchema.safeParse({...base,schemeCode:"ingot",color:"url(evil)"}).success,false);
  assert.equal(workshopSchema.safeParse({revision:0,woodCode:"spiritWood",costs:Array(23).fill(40)}).success,false);
});
test("统一六档可跨分类引用，拒绝额外等级、改名、乱序和停用",()=>{
 const qualities=qualityLevels.map(q=>({...q,revision:1,schemeCode:"unified" as const,status:"active" as const}));
 const c:Catalog={assets:[],items:[{...base,details:{source:"",description:"",weight:null,holdLimit:null,resourceCode:null,resourceYield:null,packTier:null,usageScope:"",attribute:null,contentStatus:"planned"},isMarketSellable:false,category:"processed",usageTag:"ingot",qualityCode:"fa_bao",stackLimit:99,iconPath:"",isProtected:false,isDiscardable:true}],qualities,schemes:[{...unifiedQualityScheme,revision:1}],recipes:[],workshop:null};
 assert.deepEqual(qualities.map(q=>q.name),["法器","真宝","法宝","古宝","通天灵宝","玄天之宝"]);
 assert.deepEqual(validateCatalog(c),[]);
 assert.deepEqual(validateCatalog({...c,items:[{...c.items[0],category:"resource_pack"}]}),[]);
 for(const patch of [{code:"seventh"},{name:"凡品"},{sortOrder:6},{status:"disabled"},{schemeCode:"ingot"}])assert.equal(qualitySchema.safeParse({...qualities[0],...patch}).success,false);
 assert.ok(validateCatalog({...c,qualities:qualities.slice(0,5)}).length);
 assert.ok(validateCatalog({...c,items:[{...c.items[0],qualityCode:"missing"}]}).length);
 assert.ok(validateCatalog({...c,recipes:[recipeSchema.parse(recipe)]}).length);
 assert.deepEqual(validateCatalog({...c,recipes:[recipeSchema.parse({...recipe,availability:"planned"})]}),[]);
});

test("交易行售卖默认关闭，受保护及任务物品不能放行",()=>{
 const item={...base,category:"material",usageTag:"material",qualityCode:null,stackLimit:99,iconPath:"",isProtected:false,isDiscardable:true};
 assert.equal(itemSchema.parse(item).isMarketSellable,false);
 assert.equal(itemSchema.parse({...item,isMarketSellable:true}).isMarketSellable,true);
 assert.equal(itemSchema.safeParse({...item,isMarketSellable:true,isProtected:true,isDiscardable:false}).success,false);
 assert.equal(itemSchema.safeParse({...item,category:"quest",isMarketSellable:true,isProtected:true,isDiscardable:false}).success,false);
 assert.equal(itemSchema.safeParse({...item,isMarketSellable:"true"}).success,false);
});


test("同步资料保留20资源包、54装备来源、商店常备价格及待定随机配方",async()=>{
 const {default:content}=await import("../../server/domain/items/content-v1.json");
 const {marketSchema}=await import("../../server/domain/items/market");
 const items=content.items.map(i=>itemSchema.parse(i));
 assert.equal(items.filter(i=>i.category==="resource_pack").length,20);
 assert.equal(items.filter(i=>i.category==="equipment").length,54);
 assert.ok(items.filter(i=>i.category==="equipment").every(i=>i.status==="disabled"&&i.qualityCode===null));
 assert.ok(items.every(i=>i.name&&i.details.source));
 const market=marketSchema.parse(content.market);
 assert.deepEqual(market.goods.filter(g=>g.shelf==="fixed").map(g=>g.price),[40,100,160,500]);
 assert.equal(market.groups.reduce((n,g)=>n+g.weight,0),100);
 assert.equal(market.playerSellingEnabled,false);
 assert.equal(marketSchema.safeParse({...market,playerSellingEnabled:true}).success,false);
 assert.equal(marketSchema.safeParse({...market,goods:[market.goods[0],market.goods[0]]}).success,false);
 const rune=recipeSchema.parse(content.recipes.find(r=>r.code==="rcp_random_rune"));
 assert.equal(rune.outcomes.length,7);assert.equal(rune.availability,"planned");
 assert.equal(recipeSchema.safeParse({...rune,availability:"ready"}).success,false);
});
