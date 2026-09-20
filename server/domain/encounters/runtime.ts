import {z} from "zod";
const percent=z.number().int().min(0).max(100);
const positive=z.number().int().positive();
export const enemySkillRuntimeSchema=z.object({
  version:z.literal(1),
  useBelowHpPercent:percent.optional(),
  warningTicks:z.number().int().min(0).optional(),
  appliesStatus:z.object({kind:z.enum(["slow","poison","silence","shield","bleed"]),durationTicks:positive,magnitude:z.number().int().min(0).optional(),perSecondDamage:z.number().int().min(0).optional(),chancePercent:percent.optional()}).strict().optional(),
}).strict();
export const enemyRuntimeSchema=z.object({
  version:z.literal(1),initialActionTimer:positive,
  periodicShield:z.object({intervalTicks:positive,amount:positive}).strict().optional(),
  physicalHitCounter:z.object({threshold:positive,counterPercent:positive,clearOnMagical:z.boolean(),magicalClearAmount:positive}).strict().optional(),
  allyDamageAuraPercent:percent.optional(),
  bossGoldBody:z.boolean().optional(),forcedShieldThresholds:z.array(percent).optional(),forcedShieldAmount:positive.optional(),
  shieldArmorBonus:z.number().int().min(0).optional(),coreExposedOnShieldBreak:z.boolean().optional(),coreExposedTicks:positive.optional(),
  controlImmunities:z.array(z.enum(["root"])).optional(),stunDurationPercents:z.array(percent).min(1).optional(),
  lowPhase:z.object({hpPercent:percent,skillCode:z.string().min(1),intervalPercent:positive.max(100)}).strict().optional(),
}).strict();
export type EnemySkillRuntime=z.infer<typeof enemySkillRuntimeSchema>;
export type EnemyRuntime=z.infer<typeof enemyRuntimeSchema>;
