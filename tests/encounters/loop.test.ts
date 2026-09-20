import assert from 'node:assert/strict';
import {test} from 'node:test';
import {map01LoopSchema} from '../../server/domain/encounters/loop';
import source from '../../server/domain/encounters/map01-loop.json';
test('地图1绑定与首杀装备规格有效',()=>{assert.equal(map01LoopSchema.safeParse(source).success,true);});
test('拒绝失效入口、敌人引用、装备池和重复技能',()=>{
 const cases=[(s:typeof source)=>{s.encounterBindings.enc_m1_normal_01='missing';},(s:typeof source)=>{s.combat.encounters[0].members[0].enemyId='missing';},(s:typeof source)=>{s.equipment.pool.push('missing');},(s:typeof source)=>{s.combat.skills.push(s.combat.skills[0]);}];
 for(const mutate of cases){const input=structuredClone(source);mutate(input);assert.equal(map01LoopSchema.safeParse(input).success,false);}
});
test('Boss奖励不能重复或改回旧品级',()=>{
 const input=structuredClone(source);const boss=input.combat.encounters.find(e=>e.id==='m1_boss_gate_spirit')!;
 boss.repeatSoulCrystalReward=1;assert.equal(map01LoopSchema.safeParse(input).success,false);
 boss.repeatSoulCrystalReward=0;boss.equipmentRewards![0].quantity=2;assert.equal(map01LoopSchema.safeParse(input).success,false);
});
