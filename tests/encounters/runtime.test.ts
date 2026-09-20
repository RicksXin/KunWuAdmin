import assert from 'node:assert/strict';
import {test} from 'node:test';
import {enemyRuntimeSchema,enemySkillRuntimeSchema} from '../../server/domain/encounters/runtime';
import {map01BossEquipmentRewards} from '../../server/domain/encounters/map01-rewards';

test('拒绝非法被动计时、盾量、控制倍率和未支持机制',()=>{
 const base={version:1,initialActionTimer:45};
 for(const invalid of [{...base,periodicShield:{intervalTicks:0,amount:120}},{...base,forcedShieldAmount:-1},{...base,stunDurationPercents:[100,110]},{...base,unknownMechanic:true}])assert.equal(enemyRuntimeSchema.safeParse(invalid).success,false);
 assert.equal(enemySkillRuntimeSchema.safeParse({version:1,warningTicks:-1}).success,false);
 assert.equal(enemySkillRuntimeSchema.safeParse({version:1,appliesStatus:{kind:'slow',durationTicks:40,chancePercent:101}}).success,false);
});
test('Boss奖励只采用用户新确认的法器1件和真宝1件，并保留首杀约束',()=>{
 assert.deepEqual(map01BossEquipmentRewards.equipment,[{qualityCode:'fa_qi',quantity:1},{qualityCode:'zhen_bao',quantity:1}]);
 assert.equal(map01BossEquipmentRewards.firstClearOnly,true);
 assert.equal(map01BossEquipmentRewards.implementationStatus,'development_runtime_ready');
});
