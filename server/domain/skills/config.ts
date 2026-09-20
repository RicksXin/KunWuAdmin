import { z } from "zod";

export const skillAttributes = ["strength", "magic", "technique", "speed", "constitution", "armor", "resistance"] as const;
export const skillTargets = ["SELF", "ALLY_ALL", "ALLY_LOWEST_HP", "ENEMY_SINGLE", "ENEMY_ALL", "ENEMY_LOWEST_HP", "ENEMY_HIGHEST_HP", "ENEMY_RANDOM_MULTI", "ENEMY_MOST_DEBUFFS"] as const;
const percent = z.number().int().min(0).max(10000);
const ticks = z.number().int().min(1).max(864000);
const code = z.string().regex(/^[a-z][a-z0-9_]*$/).max(96);
const formula = z.object({ flat: z.number().int().min(0).default(0), terms: z.array(z.object({ attribute: z.enum(skillAttributes), percent }).strict()).min(1).max(7) }).strict();
const recipient = z.enum(["target", "self", "all_enemies"]);
const raceTags = z.array(z.enum(["ghost", "remnant", "corpse_puppet"])).min(1);
const effectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("modifier"), target: recipient, stat: z.enum([...skillAttributes, "damage_dealt", "damage_taken", "control_resistance", "status_resistance", "accuracy", "crit_chance", "haste"]), percent: z.number().int().min(-100).max(10000), durationTicks: ticks, statusCode: code.optional() }).strict(),
  z.object({ type: z.literal("taunt"), strength: percent, durationTicks: ticks }).strict(),
  z.object({ type: z.literal("control"), status: z.literal("stun"), chanceBasisPoints: percent, durationTicks: ticks, chanceMode: z.literal("base_hit") }).strict(),
  z.object({ type: z.literal("heal"), formula: z.literal("skill_coefficients") }).strict(),
  z.object({ type: z.literal("multi_hit"), hits: z.number().int().min(2).max(10), selection: z.enum(["same_target", "distinct_then_repeat", "up_to_distinct_targets"]), repeatedTargetPercent: percent, critPerPreviousCrit: percent, independentHitAndCrit: z.literal(true) }).strict(),
  z.object({ type: z.literal("lifesteal"), percent, maxHpCapPercent: percent, scope: z.literal("whole_cast"), basis: z.literal("actual_damage") }).strict(),
  z.object({ type: z.literal("reflect"), percent, maxHpCapPercent: percent, durationTicks: ticks, basis: z.literal("actual_direct_damage_after_mitigation"), exclude: z.tuple([z.literal("dot"), z.literal("environment")]), canCrit: z.literal(false), canLifesteal: z.literal(false), triggerHitChains: z.literal(false) }).strict(),
  z.object({ type: z.literal("race_bonus"), raceTags, percent }).strict(),
  z.object({ type: z.literal("debuff_bonus"), percentPerDebuff: percent }).strict(),
  z.object({ type: z.literal("mark"), statusCode: code, durationTicks: ticks, maxStacks: z.number().int().min(1).max(20), stacksPerHit: z.literal(1), damageTag: z.literal("lightning"), damageTakenPercentPerStack: percent, refreshOnHit: z.literal(true) }).strict(),
  z.object({ type: z.literal("mark_bonus"), statusCode: code, percentPerStack: percent }).strict(),
  z.object({ type: z.literal("dot"), statusCode: code, trigger: z.enum(["on_hit", "on_critical"]), damageKind: z.enum(["physical", "magical"]), formula, durationTicks: ticks, intervalTicks: z.literal(20), maxStacks: z.number().int().min(1).max(20), stacksAdded: z.literal(1), refreshDuration: z.literal(true), canCrit: z.literal(false), raceTags: raceTags.optional() }).strict(),
  z.object({ type: z.literal("stack_damage"), statusCode: code, formula, consumeStacks: z.literal(false) }).strict(),
  z.object({ type: z.literal("refresh_status"), statusCode: code }).strict(),
  z.object({ type: z.literal("conditional_slow"), minimumDistinctTargetsHit: z.number().int().min(2), chanceBasisPoints: percent, chanceMode: z.literal("base_hit"), rollScope: z.literal("once_per_cast"), target: z.literal("all_living_enemies"), speedPercent: z.number().int().min(-100).max(-1), durationTicks: ticks }).strict(),
  z.object({ type: z.literal("crit_bonus"), percent }).strict(),
  z.object({ type: z.literal("summon"), summonCode: code, hp: formula, durationTicks: ticks, tauntStrength: percent, tauntDurationTicks: ticks, temporaryHpPercent: z.literal(100), damageOrder: z.tuple([z.literal("temporary_hp"), z.literal("hp")]), recastWhileAlive: z.literal("taunt_only"), expiresWithTemporaryHp: z.literal(true), statsSource: z.literal("caster") }).strict(),
]);
export type SkillEffect = z.infer<typeof effectSchema>;
export const coefficientsSchema = z.object({
  baseIntervalTicks: ticks, castTicks: z.number().int().min(0).max(864000), cooldownTicks: z.number().int().min(0).max(864000),
  primaryAttribute: z.enum(skillAttributes).nullable(), primaryPercent: percent,
  secondaryAttribute: z.enum(skillAttributes).nullable(), secondaryPercent: percent,
}).strict().superRefine((v,c) => {
  for (const [attribute, value] of [[v.primaryAttribute,v.primaryPercent],[v.secondaryAttribute,v.secondaryPercent]]) {
    if (attribute ? Number(value) <= 0 : value !== 0) c.addIssue({code:"custom",message:"属性与正倍率必须同时配置"});
  }
});
const atom = z.object({
  metric: z.enum(["self_hp_percent", "party_average_hp_percent", "ally_min_hp_percent", "enemy_count", "ghost_enemy_count", "target_debuff_count", "target_status_stacks", "self_has_status", "target_has_status", "summon_alive", "high_threat_enemy_exists", "enemy_preparing_high_threat_skill", "always"]),
  operator: z.enum(["lt", "gte", "eq"]), value: z.number().int().min(0).max(10000), reference: code.optional(),
}).strict().superRefine((v,c)=>{
  if (["target_status_stacks","self_has_status","target_has_status","summon_alive"].includes(v.metric) && !v.reference) c.addIssue({code:"custom",message:"状态/召唤条件必须指定引用"});
});
export const aiRuleSchema = z.object({ priority: z.number().int().min(0), anyOf: z.array(z.array(atom).min(1)).min(1), targetSelector: z.enum([...skillTargets,"ENEMY_HIGH_THREAT"]).nullable() }).strict();
const tags = z.array(z.enum(["ignore_flying_penalty", "lightning"]));
export const mechanicsSchema = z.object({
  schemaVersion: z.literal(1), source: z.object({ document: z.string().min(1), version: z.string().min(1) }).strict(),
  tags, effects: z.array(effectSchema).max(24), ai: z.array(aiRuleSchema).max(8),
  mastery: z.object({ ...coefficientsSchema.shape, effects: z.array(effectSchema).max(24), tags }).strict().nullable(),
}).strict().superRefine((v,c)=>{
  if (v.mastery) {
    const {baseIntervalTicks,castTicks,cooldownTicks,primaryAttribute,primaryPercent,secondaryAttribute,secondaryPercent}=v.mastery;
    const stats={baseIntervalTicks,castTicks,cooldownTicks,primaryAttribute,primaryPercent,secondaryAttribute,secondaryPercent};
    const parsed=coefficientsSchema.safeParse(stats);
    if(!parsed.success)c.addIssue({code:"custom",path:["mastery"],message:parsed.error.issues.map(i=>i.message).join("；")});
  }
  if(new Set(v.ai.map(r=>r.priority)).size!==v.ai.length)c.addIssue({code:"custom",message:"同技能AI优先级不能重复"});
});
export type SkillMechanics = z.infer<typeof mechanicsSchema>;
export const skillDefinitionSchema = z.object({
  code, name:z.string().min(1), damageKind:z.enum(["physical","magical","none"]), targetType:z.enum(skillTargets), ignoreTaunt:z.boolean(),
  ...coefficientsSchema.shape, mechanics: mechanicsSchema,
}).strict().superRefine((v,c)=>{
  const {baseIntervalTicks,castTicks,cooldownTicks,primaryAttribute,primaryPercent,secondaryAttribute,secondaryPercent}=v;
  if(!coefficientsSchema.safeParse({baseIntervalTicks,castTicks,cooldownTicks,primaryAttribute,primaryPercent,secondaryAttribute,secondaryPercent}).success)c.addIssue({code:"custom",message:"基础技能倍率非法"});
  for(const stage of [v,v.mechanics.mastery].filter(s=>s!==null)) {
    if(v.damageKind!=="none"&&(!stage.primaryAttribute||stage.primaryPercent<=0))c.addIssue({code:"custom",message:"伤害技能各阶段必须有正伤害倍率"});
  }
  for(const stage of [{...v,effects:v.mechanics.effects},v.mechanics.mastery].filter(s=>s!==null)){
    if(v.damageKind==="none"&&stage.effects.length===0)c.addIssue({code:"custom",message:"无直接伤害的技能必须配置效果"});
    if(stage.effects.some(e=>e.type==="heal")&&(!stage.primaryAttribute||stage.primaryPercent<=0))c.addIssue({code:"custom",message:"治疗必须配置正治疗倍率"});
  }
});
export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;

export function validateSkillReferences(definitions:SkillDefinition[]) {
  const statuses=new Set<string>(),summons=new Set<string>(),errors:string[]=[];
  for(const s of definitions)for(const effect of [...s.mechanics.effects,...(s.mechanics.mastery?.effects??[])]){
    if(["modifier","dot","mark"].includes(effect.type)&&"statusCode" in effect&&effect.statusCode)statuses.add(effect.statusCode);
    if(effect.type==="taunt"||effect.type==="reflect")statuses.add(effect.type);
    if(effect.type==="summon")summons.add(effect.summonCode);
  }
  for(const s of definitions){
    for(const a of s.mechanics.ai)for(const group of a.anyOf)for(const condition of group){
      if(condition.reference&&!(condition.metric==="summon_alive"?summons:statuses).has(condition.reference))errors.push(`${s.code} 自动策略引用不存在：${condition.reference}`);
    }
    for(const effect of [...s.mechanics.effects,...(s.mechanics.mastery?.effects??[])])if(["refresh_status","stack_damage","mark_bonus"].includes(effect.type)&&"statusCode" in effect&&!statuses.has(effect.statusCode!))errors.push(`${s.code} 效果引用不存在：${effect.statusCode}`);
  }
  return errors;
}

/** Called with career tier, never merely level: mastery requires the core career. */
export function resolveSkillStage(skill: SkillDefinition, careerTier: number) {
  const stage = careerTier >= 2 ? skill.mechanics.mastery : null;
  if(careerTier>=2&&!stage)throw new Error(`${skill.code} 缺少精通配置`);
  return {...skill,...stage,code:skill.code,targetType:skill.targetType,damageKind:skill.damageKind,effects:stage?.effects??skill.mechanics.effects,tags:stage?.tags??skill.mechanics.tags,proficiency:stage?"mastery":"base"};
}
