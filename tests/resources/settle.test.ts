import test from "node:test";
import assert from "node:assert/strict";
import { assetCodes, baselineCatalog, legacyBaselineRules as baselineRules, rulesSchema, simulationInputSchema, type AssetCode } from "../../server/domain/resources/rules";
import { applyCommand as applyCommandRaw, createSimulation as createSimulationRaw, productionStatus as productionStatusRaw, createFarm as createFarmRaw, settle as settleRaw, zeroAmounts, type FarmState } from "../../server/domain/resources/settle";

const createFarm = (time=0) => createFarmRaw(time, baselineRules);
const settle: typeof settleRaw = (state, target, rules=baselineRules, activations=[], budget=20000) => settleRaw(state,target,rules,activations,budget);
const applyCommand: typeof applyCommandRaw = (state, command, rules=baselineRules) => applyCommandRaw(state,command,rules);
const createSimulation: typeof createSimulationRaw = (input, rules=baselineRules) => createSimulationRaw(input,rules);
const productionStatus: typeof productionStatusRaw = (state, rules=baselineRules) => productionStatusRaw(state,rules);

const allocate = (state:FarmState, values:Partial<Record<AssetCode,number>>) => applyCommand(state,{type:"allocation",allocations:Object.fromEntries(assetCodes.map(c => [c,values[c]??0])) as Record<AssetCode,number>}).state;
test("frozen baseline: five resources and all storage values", () => {
  assert.deepEqual(baselineRules.jobs.map(j => j.code),assetCodes);
  assert.equal(baselineRules.jobs[3].storage[3].upgradeWood,"1400");
  assert.deepEqual(baselineRules.recruitCosts,["300","450","650","900","1200","1600"]);
  assert.throws(() => rulesSchema.parse({...baselineRules,jobs:baselineRules.jobs.map(j => ({...j,upkeep:"9"}))}));
});
test("RES-A01 one grain and wood, no premature next-cycle charge", () => {
  const state=allocate(createFarm(),{spiritGrain:1,spiritWood:1}); state.balances.spiritGrain="10";
  const result=settle(state,30000);
  assert.equal(result.state.balances.spiritGrain,"20"); assert.equal(result.state.balances.spiritWood,"6");
  assert.deepEqual(settle(result.state,30000).state,result.state);
});
test("RES-A02 upkeep can decrease grain balance", () => {
  const state=allocate(createFarm(),{spiritWood:1}); state.balances.spiritGrain="4";
  const result=settle(state,60000); assert.equal(result.state.balances.spiritGrain,"0"); assert.equal(result.state.balances.spiritWood,"12");
});
test("zero starting grain cannot borrow first-cycle grain", () => {
  const state=allocate(createFarm(),{spiritGrain:1,spiritWood:1}); state.balances.spiritGrain="0";
  const first=settle(state,30000).state; assert.equal(first.balances.spiritWood,"0");
  assert.equal(settle(first,60000).state.balances.spiritWood,"6");
});
test("entire due job group must afford upkeep, lower priority can use remainder", () => {
  const state=allocate(createFarm(),{spiritWood:2,darkIron:1}); state.balances.spiritGrain="2";
  const result=settle(state,30000).state; assert.equal(result.balances.spiritWood,"0"); assert.equal(result.balances.darkIron,"3");
});
test("full and partially full stores; no hidden rewards", () => {
  const state=allocate(createFarm(),{spiritWood:1}); state.balances.spiritWood="299";
  const result=settle(state,300000); assert.equal(result.state.balances.spiritGrain,"118");
  assert.equal(result.state.balances.spiritWood,"300"); assert.equal(result.report.overflow.spiritWood,"5");
  const adjusted=applyCommand(result.state,{type:"adjust",asset:"spiritWood",mode:"subtract",amount:"10"}).state;
  assert.equal(settle(adjusted,330000).state.balances.spiritWood,"296");
});
test("geng parity survives lack of grain and reassignment", () => {
  let state=createFarm(); state.highestMap=3; state=allocate(state,{gengJing:1}); state.balances.spiritGrain="2";
  state=settle(state,30000).state; assert.equal(state.workers[0].gengParity,1); assert.equal(state.balances.gengJing,"0");
  state=settle(state,60000).state; assert.equal(state.workers[0].gengParity,1);
  state=allocate(state,{}); state=settle(state,90000).state; state=allocate(state,{gengJing:1});
  state=applyCommand(state,{type:"adjust",asset:"spiritGrain",mode:"add",amount:"2"}).state;
  state=settle(state,120000).state; assert.equal(state.balances.gengJing,"1"); assert.equal(state.workers[0].gengParity,0);
});
test("dew preserves exact fraction and does not repay ticket", () => {
  let state=allocate(createFarm(),{spiritWood:1}); state=settle(state,15000).state;
  state=applyCommand(state,{type:"dew",level:1}).state;
  state=settle(state,27499).state; assert.equal(state.balances.spiritWood,"0");
  state=settle(state,27500).state; assert.equal(state.balances.spiritWood,"6"); assert.equal(state.balances.spiritGrain,"118");
});
test("grain-to-consumer switching pays before completing carried progress", () => {
  let state=allocate(createFarm(),{spiritGrain:1}); state=settle(state,15000).state;
  state=allocate(state,{spiritWood:1}); state=settle(state,30000).state;
  assert.equal(state.balances.spiritWood,"6"); assert.equal(state.balances.spiritGrain,"118");
});
test("repeated switches don't duplicate progress or refund already paid grain", () => {
  let state=allocate(createFarm(),{spiritWood:1}); state=settle(state,15000).state;
  for(let i=0;i<20;i++) { state=allocate(state,{darkIron:1}); state=allocate(state,{spiritWood:1}); }
  state=settle(state,30000).state; assert.equal(state.balances.spiritWood,"6"); assert.equal(state.balances.spiritGrain,"118");
});
test("paid partial cycle freezes during admin full-store adjustment", () => {
  let state=allocate(createFarm(),{spiritWood:1}); state=settle(state,15000).state;
  state=applyCommand(state,{type:"adjust",asset:"spiritWood",mode:"set",amount:"300"}).state;
  state=settle(state,150000).state; assert.equal(state.balances.spiritGrain,"118");
  state=applyCommand(state,{type:"adjust",asset:"spiritWood",mode:"subtract",amount:"6"}).state;
  state=settle(state,165000).state; assert.equal(state.balances.spiritWood,"300"); assert.equal(state.balances.spiritGrain,"118");
});
test("recruit cap, exact costs and failure leave input untouched", () => {
  let state=createFarm(); state.storageLevels.spiritGrain=5; state.balances.spiritGrain="6000";
  for(let i=0;i<6;i++) state=applyCommand(state,{type:"recruit"}).state;
  assert.equal(state.balances.spiritGrain,"900"); assert.equal(state.workers.length,12);
  const before=structuredClone(state); assert.throws(() => applyCommand(state,{type:"recruit"}),/WORKER_LIMIT/); assert.deepEqual(state,before);
});
test("capacity upgrade and legal reductions of legacy over-capacity funds", () => {
  const state=createFarm(); state.balances.spiritWood="100";
  const next=applyCommand(state,{type:"storage",asset:"spiritWood"}).state;
  assert.equal(next.storageLevels.spiritWood,2); assert.equal(next.balances.spiritWood,"0");
  assert.throws(() => applyCommand(state,{type:"adjust",asset:"spiritWood",mode:"set",amount:"301"}));
  state.balances.spiritWood="500";
  assert.equal(applyCommand(state,{type:"adjust",asset:"spiritWood",mode:"subtract",amount:"1"}).state.balances.spiritWood,"499");
  assert.throws(() => applyCommand(state,{type:"adjust",asset:"spiritWood",mode:"add",amount:"1"}));
});
test("publication boundary applies old-cycle output then new rules", () => {
  const state=allocate(createFarm(),{spiritGrain:1}); state.balances.spiritGrain="0";
  const rules=structuredClone(baselineRules); rules.releaseId="next"; rules.jobs[0].output="24";
  const result=settle(state,60000,baselineRules,[{atMs:30000,rules}]); assert.equal(result.state.balances.spiritGrain,"36");
});
test("bounded work resumes with exact state, no offline cap", () => {
  const input=allocate(createFarm(),{spiritGrain:1,spiritWood:2,darkIron:1});
  const whole=settle(input,86400000); let resumed=settle(input,86400000,baselineRules,[],1), count=0;
  while(!resumed.complete) { resumed=settle(resumed.state,86400000,baselineRules,[],1); assert.ok(++count<10000); }
  assert.deepEqual(resumed.state,whole.state); assert.ok(whole.complete);
});
test("150 seeded arbitrary time splits equal one settlement, including rational progress", () => {
  let seed=123;
  const random=() => { seed=(seed*1664525+1013904223)>>>0; return seed; };
  for(let i=0;i<150;i++) {
    let s=createFarm(); s.highestMap=3; s.dewLevel=i%3;
    s.balances.spiritGrain=String(random()%400); s=allocate(s,{spiritGrain:1,spiritWood:1,darkIron:1,gengJing:1});
    const end=1000+random()%1000000, split=random()%end;
    assert.deepEqual(settle(settle(s,split).state,end).state,settle(s,end).state);
  }
});
test("ledger reconciles before/after for every entry and total", () => {
  const before=allocate(createFarm(),{spiritGrain:1,spiritWood:2}); const result=settle(before,86400000);
  const balances=structuredClone(before.balances);
  for(const event of result.report.events) { assert.equal(balances[event.asset],event.before); balances[event.asset]=String(BigInt(balances[event.asset])+BigInt(event.delta)); assert.equal(balances[event.asset],event.after); }
  assert.deepEqual(balances,result.state.balances);
});
test("time rollback and invalid public simulation input are rejected", () => {
  assert.throws(() => settle(createFarm(10),9),/TIME_INVALID/);
  assert.equal(simulationInputSchema.safeParse({balances:zeroAmounts(),allocations:{},storageLevels:{},workers:6,dewLevel:0,highestMap:1,durationSeconds:60}).success,false);
});

test("resource catalog remains compatible with old releases and protects referenced codes",()=>{
  assert.equal(rulesSchema.parse(baselineRules).catalog,undefined);
  const catalog=structuredClone(baselineCatalog);catalog[0].displayName="测试灵粮";
  assert.equal(rulesSchema.parse({...baselineRules,catalog}).catalog![0].displayName,"测试灵粮");
  assert.throws(()=>rulesSchema.parse({...baselineRules,catalog:catalog.slice(1)}));
  assert.throws(()=>rulesSchema.parse({...baselineRules,catalog:catalog.map((c,i)=>i===0?{...c,enabled:false}:c)}));
  assert.throws(()=>rulesSchema.parse({...baselineRules,catalog:catalog.map((c,i)=>i===0?{...c,iconRef:"resource:missing"}:c)}));
  const a=allocate(createFarm(),{spiritGrain:1});
  assert.deepEqual(settle(a,30000).state.balances,settle(a,30000,{...baselineRules,catalog}).state.balances);
});
test("simulator personal progress preserves paid upkeep and geng parity",()=>{
  const base={balances:{...zeroAmounts(),spiritGrain:"10"},allocations:{...Object.fromEntries(assetCodes.map(c=>[c,0])),gengJing:1},storageLevels:Object.fromEntries(assetCodes.map(c=>[c,1])),workers:6,dewLevel:0,highestMap:3,durationSeconds:15,workerProgress:Array.from({length:6},(_,i)=>({progressPercent:i===0?50:0,gengParity:i===0?1:0,maintenancePaid:i===0}))};
  const input=simulationInputSchema.parse(base),state=createSimulation(input);
  const result=settle(state,15000);assert.equal(result.state.balances.gengJing,"1");assert.equal(result.state.balances.spiritGrain,"10");
  const unpaid=createSimulation(simulationInputSchema.parse({...base,workerProgress:base.workerProgress.map(w=>({...w,maintenancePaid:false}))}));
  assert.equal(settle(unpaid,15000).state.balances.spiritGrain,"8");
  assert.equal(productionStatus({...state,balances:{...state.balances,gengJing:"20"}}).gengJing,"满仓停工");
  assert.throws(()=>simulationInputSchema.parse({...base,workerProgress:[]}));
  assert.throws(()=>simulationInputSchema.parse({...base,workerProgress:base.workerProgress.map(w=>({...w,progressPercent:100}))}));
});
