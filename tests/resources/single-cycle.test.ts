import test from "node:test";
import assert from "node:assert/strict";
import { assetCodes, baselineRules, legacyBaselineRules, currentRulesSchema, rulesSchema } from "../../server/domain/resources/rules";
import { applyCommand, createFarm, settle } from "../../server/domain/resources/settle";

test("each resource produces one unit per worker per cycle at every dew level", () => {
  for (const code of assetCodes) for (const count of [0, 1, 2, 6]) for (const dewLevel of [0, 1, 2]) {
    let state = createFarm();
    state.highestMap = 3;
    state.dewLevel = dewLevel;
    state = applyCommand(state, {type:"allocation", allocations:{spiritGrain:0,spiritWood:0,darkIron:0,spiritCrystal:0,gengJing:0,[code]:count}}).state;
    const cycle = baselineRules.cyclesMs[dewLevel];
    assert.equal(settle(state,cycle-1).report.produced[code],"0");
    assert.equal(settle(state,cycle).report.produced[code],String(count));
    assert.equal(settle(state,cycle*2).report.produced[code],String(count*2));
  }
});
test("new configurations freeze output and cycle without rejecting historical releases", () => {
  assert.ok(rulesSchema.safeParse(legacyBaselineRules).success);
  assert.ok(currentRulesSchema.safeParse(baselineRules).success);
  assert.equal(currentRulesSchema.safeParse(legacyBaselineRules).success,false);
  for (const code of assetCodes) for (const patch of [{output:"2"},{cycles:2}]) {
    assert.equal(currentRulesSchema.safeParse({...baselineRules,jobs:baselineRules.jobs.map(job=>job.code===code?{...job,...patch}:job)}).success,false);
  }
});
test("release boundary preserves old earnings and starts single-cycle production for geng", () => {
  for (const code of ["spiritGrain", "gengJing"] as const) {
    let state=createFarm(0,legacyBaselineRules); state.highestMap=3;
    state=applyCommand(state,{type:"allocation",allocations:{spiritGrain:0,spiritWood:0,darkIron:0,spiritCrystal:0,gengJing:0,[code]:1}},legacyBaselineRules).state;
    const result=settle(state,60000,legacyBaselineRules,[{atMs:30000,rules:baselineRules}]);
    assert.equal(result.report.produced[code],code==="spiritGrain"?"13":"1");
    assert.equal(result.state.rulesId,baselineRules.releaseId);
  }
});

test("recruit costs must be positive and strictly increasing within storage capacity", () => {
  for (const recruitCosts of [
    ["0","20","30","40","50","60"],
    ["10","10","30","40","50","60"],
    ["20","10","30","40","50","60"],
    ["10","20","30","40","50","6001"],
    ["10","20","30","40","50","invalid"],
  ]) assert.equal(currentRulesSchema.safeParse({...baselineRules,recruitCosts}).success,false);
  assert.ok(currentRulesSchema.safeParse({...baselineRules,recruitCosts:["10","20","30","40","50","60"]}).success);
  // A historical release with equal costs must remain readable for past settlements.
  assert.ok(rulesSchema.safeParse({...baselineRules,recruitCosts:["10","10","30","40","50","60"]}).success);
});

test("recruitment deducts the configured cost for each next worker", () => {
  const rules=currentRulesSchema.parse({...baselineRules,recruitCosts:["10","20","30","40","50","60"]});
  let state=createFarm(0,rules); state.balances.spiritGrain="300";
  const expected=["290","270","240","200","150","90"];
  for(let i=0;i<6;i++) {
    state=applyCommand(state,{type:"recruit"},rules).state;
    assert.equal(state.workers.length,7+i);
    assert.equal(state.balances.spiritGrain,expected[i]);
  }
  assert.throws(()=>applyCommand(state,{type:"recruit"},rules),/WORKER_LIMIT/);
  const poor=createFarm(0,rules); poor.balances.spiritGrain="9";
  const before=structuredClone(poor);
  assert.throws(()=>applyCommand(poor,{type:"recruit"},rules),/INSUFFICIENT_RESOURCE/);
  assert.deepEqual(poor,before);
});
