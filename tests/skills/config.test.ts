import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { skillContent,careerSkillContent } from "../../server/domain/skills/content-v1";
import { mechanicsSchema,resolveSkillStage,skillDefinitionSchema,validateSkillReferences } from "../../server/domain/skills/config";
const find=(code:string)=>{const s=skillContent.find(s=>s.code===code);assert.ok(s,code);return s;};
const source=readFileSync(new URL("./fixtures/skills-v1.md",import.meta.url),"utf8");

test("36个稳定ID、名称、基础与精通时间和倍率逐行匹配源文",()=>{
  const rows=source.split("\n").filter(l=>/^\| `skill_/.test(l));
  assert.equal(rows.length,36);assert.equal(skillContent.length,36);
  assert.equal(new Set(skillContent.map(s=>s.code)).size,36);
  assert.equal(skillContent.filter(s=>s.mechanics.mastery).length,24);
  const attrs:Record<string,string>={力:"strength",法:"magic",神:"technique",肉:"constitution",定:"resistance"};
  rows.forEach((line,index)=>{
    const cells=line.split("|").slice(1,-1).map(v=>v.trim());
    const [,code,name]=cells[0].match(/^`([^`]+)` (.+)$/)!;
    const skill=find(code);assert.equal(skill.name,name);
    const stages=index<12?[{value:skill,text:`${cells[2]}；${cells[3]}`}]:[{value:skill,text:cells[2]},{value:skill.mechanics.mastery!,text:cells[3]}];
    for(const {value,text} of stages){
      const times=text.match(/^(\d+)\/(\d+)/)!;
      assert.equal(value.baseIntervalTicks,Number(times[1]),code);
      assert.equal(value.cooldownTicks,Number(times[2]),code);
      const formula=text.match(/`(\d+)%([力法神肉定])\+(\d+)%([力法神肉定])`/);
      if(formula){
        assert.equal(value.primaryAttribute,attrs[formula[2]],code);assert.equal(value.primaryPercent,Number(formula[1]),code);
        assert.equal(value.secondaryAttribute,attrs[formula[4]],code);assert.equal(value.secondaryPercent,Number(formula[3]),code);
      }
    }
  });
});
test("20职业阶段60槽；结丹复用筑基ID并解析精通",()=>{
  assert.equal(careerSkillContent.length,20);
  for(const c of careerSkillContent){
    assert.equal(c.skills.length,3);assert.equal(new Set(c.skills).size,3);
    for(const code of c.skills){
      const skill=find(code),resolved=resolveSkillStage(skill,c.tier);
      assert.equal(resolved.code,code);assert.equal(resolved.targetType,skill.targetType);
      assert.equal(resolved.proficiency,c.tier===2?"mastery":"base");
      if(c.tier===2){assert.ok(careerSkillContent.some(b=>b.tier===1&&JSON.stringify(b.skills)===JSON.stringify(c.skills)));assert.ok(skill.mechanics.mastery);}
    }
  }
  assert.throws(()=>resolveSkillStage(find("skill_chan_fumo"),2),/缺少精通/);
});
test("符修治疗目标和符傀重放契约保留，不将嘲讽转移给本体",()=>{
  assert.equal(find("skill_ghost_restore").targetType,"ALLY_ALL");
  assert.equal(find("skill_myriad_restore").targetType,"ALLY_LOWEST_HP");
  for(const tier of [1,2]){
    const s=resolveSkillStage(find("skill_myriad_puppet"),tier);
    const p=s.effects.find(e=>e.type==="summon");assert.ok(p&&p.type==="summon");
    assert.equal(p.recastWhileAlive,"taunt_only");assert.equal(p.temporaryHpPercent,100);assert.equal(p.statsSource,"caster");
    assert.deepEqual(p.damageOrder,["temporary_hp","hp"]);
    assert.equal(p.hp.flat,tier===1?120:160);assert.deepEqual(p.hp.terms.map(t=>t.percent),tier===1?[250,300]:[280,340]);
    assert.equal(s.effects.some(e=>e.type==="taunt"),false);
  }
});
test("反伤不递归；雷链只做一次概率检定；剑煞精通升级且不消耗层数",()=>{
  const reflect=find("skill_guard_reflect").mechanics.effects[0];assert.ok(reflect.type==="reflect");
  assert.equal(reflect.triggerHitChains,false);assert.equal(reflect.canLifesteal,false);assert.deepEqual(reflect.exclude,["dot","environment"]);
  const slow=find("skill_thunder_chain").mechanics.effects.find(e=>e.type==="conditional_slow");assert.ok(slow?.type==="conditional_slow");
  assert.equal(slow.minimumDistinctTargetsHit,2);assert.equal(slow.rollScope,"once_per_cast");assert.equal(slow.target,"all_living_enemies");
  for(const tier of [1,2])for(const code of ["skill_azure_star","skill_azure_chase","skill_azure_dot"]){
    const d=resolveSkillStage(find(code),tier).effects.find(e=>e.type==="dot");assert.ok(d?.type==="dot");assert.equal(d.maxStacks,tier===1?5:7);assert.equal(d.trigger,"on_critical");assert.equal(d.canCrit,false);
  }
  const bonus=find("skill_azure_dot").mechanics.effects.find(e=>e.type==="stack_damage");assert.ok(bonus?.type==="stack_damage");assert.equal(bonus.consumeStacks,false);
});
test("拒绝精通负时间、概率越界、危险召唤重放和缺少条件引用",()=>{
  const puppet=structuredClone(find("skill_myriad_puppet").mechanics);
  assert.equal(mechanicsSchema.safeParse({...puppet,mastery:{...puppet.mastery,baseIntervalTicks:0}}).success,false);
  assert.equal(mechanicsSchema.safeParse({...puppet,effects:[{...puppet.effects[0],recastWhileAlive:"heal_full"}]}).success,false);
  const heavy=structuredClone(find("skill_heavy_stun"));
  const effect=heavy.mechanics.effects[0];assert.ok(effect.type==="control");effect.chanceBasisPoints=10001;
  assert.equal(skillDefinitionSchema.safeParse(heavy).success,false);
  const roar=structuredClone(find("skill_guard_roar").mechanics);delete roar.ai[0].anyOf[0][0].reference;
  assert.equal(mechanicsSchema.safeParse(roar).success,false);
});
test("自动策略保留OR/AND和优先级；炼气未冒充有来源默认策略",()=>{
  assert.deepEqual(validateSkillReferences(skillContent),[]);
  const invalid=structuredClone(skillContent);invalid.find(s=>s.code==="skill_ghost_restore")!.mechanics.ai[0].anyOf[0][0].reference="missing_status";
  assert.ok(validateSkillReferences(invalid).some(e=>e.includes("missing_status")));
  assert.equal(find("skill_ghost_restore").mechanics.ai[0].anyOf.length,2);
  assert.equal(find("skill_illusion_drain").mechanics.ai[0].anyOf[0].length,2);
  assert.equal(find("skill_myriad_puppet").mechanics.ai[0].priority,0);
  assert.equal(find("skill_myriad_restore").mechanics.ai[0].priority,1);
  for(const c of careerSkillContent.filter(c=>c.tier===0))for(const code of c.skills)assert.deepEqual(find(code).mechanics.ai,[]);
});
