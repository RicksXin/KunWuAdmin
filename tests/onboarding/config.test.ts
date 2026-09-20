import test from "node:test";
import assert from "node:assert/strict";
import {initialCamp,completeCampDialogue,onboardingConfig} from "../../server/domain/onboarding/config";
import {baselineRules} from "../../server/domain/resources/rules";
import {validateBattleDesign,enemyDesignSchema,encounterDesignSchema,type EnemyContent} from "../../server/domain/encounters/config";
import content from "../../server/domain/encounters/content-v1.json";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

test("新玩家只开放议事殿；指定NPC对话才初始化生产且不追算出生以来收益",()=>{
  const state=initialCamp(["ling_pu","lian_qi_fang","bai_bao_ku"]);
  assert.deepEqual(state.buildingLevels,{yi_shi_dian:1,ling_pu:0,lian_qi_fang:0,bai_bao_ku:0});assert.equal(state.farm,null);
  assert.equal(completeCampDialogue(state,{sceneCode:"P0-02",npcCode:"npc_cen_shouyi"},5000,baselineRules),state);
  assert.equal(completeCampDialogue(state,{sceneCode:"P0-01",npcCode:"other"},5000,baselineRules),state);
  const next=completeCampDialogue(state,onboardingConfig.unlock,5000,baselineRules);
  assert.equal(next.buildingLevels.ling_pu,1);assert.equal(next.buildingLevels.bai_bao_ku,0);assert.equal(next.buildingLevels.lian_qi_fang,0);
  assert.equal(next.farm?.workers.length,6);assert.ok(next.farm?.workers.every(w=>w.job===null));assert.equal(next.farm?.balances.spiritGrain,"120");
  assert.equal(state.farm,null);assert.deepEqual(next.farm?.time,["5000","1"]);
});
test("重看对话不重置库存、建筑、杂役与一次性标记",()=>{
  const state=completeCampDialogue(initialCamp(["ling_pu"]),onboardingConfig.unlock,1000,baselineRules);
  state.farm!.balances.spiritGrain="300";state.buildingLevels.ling_pu=2;
  const result=completeCampDialogue(state,onboardingConfig.unlock,99999,baselineRules);
  assert.equal(result,state);assert.equal(result.farm!.balances.spiritGrain,"300");assert.equal(result.buildingLevels.ling_pu,2);assert.equal(result.completedClaims.length,1);
});
const enemies=content.enemies.map(e=>({...e,rank:e.rank as EnemyContent["rank"],design:enemyDesignSchema.parse(e.design)}));
const encounters=content.encounters.map(e=>({...e,design:encounterDesignSchema.parse(e.design)}));
test("38敌人、70遭遇满足新地图编成与唯一Boss奖励约束",()=>{
  assert.equal(enemies.length,38);assert.equal(encounters.length,70);assert.deepEqual(validateBattleDesign(enemies,encounters),[]);
  for(let m=1;m<=4;m++){
    const group=encounters.filter(e=>e.design.mapNumber===m);
    assert.equal(group.filter(e=>["low","medium","high"].includes(e.design.difficulty)).length,[10,12,14,16][m-1]);
    assert.equal(group.filter(e=>e.design.difficulty==="elite").length,m+1);
    assert.equal(group.filter(e=>e.design.difficulty==="boss").length,1);
    const normal=group.filter(e=>["low","medium","high"].includes(e.design.difficulty));
    assert.ok(normal.every((e,i)=>e.design.difficulty!=="high"||normal[i-1]?.design.difficulty!=="high"));
  }
  assert.equal(encounters.filter(e=>e.design.bossSoulCode).length,2);
  const bad=structuredClone(encounters);bad[0].design.members=[{enemyCode:"m1_array_glow",quantity:2}];
  assert.ok(validateBattleDesign(enemies,bad).some(e=>e.includes("上限")));
});
test("敌人HP/七维保留来源行，来源快照哈希一致",()=>{
  const source=readFileSync(new URL("../../server/domain/encounters/source-v1.md",import.meta.url),"utf8");
  assert.equal(createHash("sha256").update(source).digest("hex"),content.sourceHash);
  for(const e of enemies.filter(e=>e.rank!=="boss")){
    assert.ok(source.includes(e.design.source.text));const cells=e.design.source.text.split("|").slice(1,-1).map(c=>c.trim());
    const index=cells.findIndex(c=>/^\d+(\/\d+){6}$/.test(c));
    assert.deepEqual(e.stats,cells[index].split("/").map(Number));
    assert.equal(e.maxHp,Number(index===3?cells[2]:cells[1].split("/")[1]));
  }
});
