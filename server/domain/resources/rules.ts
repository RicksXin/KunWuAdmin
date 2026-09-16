import { z } from "zod";

export const assetCodes = ["spiritGrain", "spiritWood", "darkIron", "spiritCrystal", "gengJing"] as const;
export type AssetCode = typeof assetCodes[number];
export const assetNames: Record<AssetCode, string> = {
  spiritGrain: "灵粮", spiritWood: "灵木", darkIron: "玄铁", spiritCrystal: "灵晶", gengJing: "庚精",
};
const metadataText = z.string().trim().min(1).max(200);
export const catalogSchema = z.array(z.object({
  code:z.enum(assetCodes),displayName:metadataText,nameKey:metadataText,
  category:z.literal("production"),iconRef:metadataText,storage:z.literal("public"),
  capacityPolicy:z.literal("production_tier"),enabled:z.literal(true),
  sourceRef:metadataText,usageRef:metadataText,
}).strict()).length(5).superRefine((items,c)=>{
  if(items.some((item,i)=>item.code!==assetCodes[i]))c.addIssue({code:"custom",message:"已引用的五类资源必须完整保留，code 与顺序不可改变"});
  if(items.some(item=>item.iconRef!==`resource:${item.code}`))c.addIssue({code:"custom",message:"图标引用必须使用对应资源的稳定标识"});
  if(new Set(items.map(item=>item.nameKey)).size!==items.length)c.addIssue({code:"custom",message:"资源名称键不能重复"});
});
export type ResourceCatalog = z.infer<typeof catalogSchema>;
export const baselineCatalog:ResourceCatalog=assetCodes.map(code=>({code,displayName:assetNames[code],nameKey:`resource.${code}.name`,category:"production",iconRef:`resource:${code}`,storage:"public",capacityPolicy:"production_tier",enabled:true,sourceRef:"灵源院生产；34_1.0基础材料与资源循环 §生产资源",usageRef:"36_营地后勤与野外循环机制 §储量与消费"}));
export const MAX_AMOUNT = BigInt("9223372036854775807");
export const amountSchema = z.string().regex(/^(0|[1-9]\d{0,18})$/).refine(v => /^(0|[1-9]\d{0,18})$/.test(v) && BigInt(v) <= MAX_AMOUNT, "金额超出范围");
const storageSchema = z.object({ capacity: amountSchema, upgradeWood: amountSchema }).strict();
const jobSchema = z.object({
  code: z.enum(assetCodes), output: amountSchema, cycles: z.number().int().min(1).max(2),
  upkeep: amountSchema, unlockMap: z.number().int().min(1).max(4),
  storage: z.array(storageSchema).length(5),
}).strict();
export const rulesSchema = z.object({
  catalog: catalogSchema.optional(),
  schemaVersion: z.union([z.literal(2), z.literal(3)]), releaseId: z.string().min(1).max(96),
  initialWorkers: z.literal(6), maxWorkers: z.literal(12), offlinePolicy: z.literal("unbounded"),
  cyclesMs: z.tuple([z.literal(30000), z.literal(25000), z.literal(20000)]),
  recruitCosts: z.array(amountSchema).length(6), jobs: z.array(jobSchema).length(5),
}).strict().superRefine((rules, context) => {
  if(rules.jobs.length!==5||rules.recruitCosts.length!==6||rules.jobs.some(j=>j.storage.length!==5))return;
  const values=[...rules.recruitCosts,...rules.jobs.flatMap(j=>[j.output,j.upkeep,...j.storage.flatMap(s=>[s.capacity,s.upgradeWood])])];
  if(values.some(v=>!amountSchema.safeParse(v).success))return;
  if (rules.jobs.some((job, index) => job.code !== assetCodes[index]))
    context.addIssue({ code: "custom", message: "岗位必须按灵粮、灵木、玄铁、灵晶、庚精顺序提供" });
  const wood=rules.jobs.find(j=>j.code==="spiritWood");
  const grain=rules.jobs.find(j=>j.code==="spiritGrain");
  if(grain&&rules.recruitCosts.some((cost,i)=>BigInt(cost)>BigInt(grain.storage[4].capacity)||(i>0&&BigInt(cost)<BigInt(rules.recruitCosts[i-1]))))
    context.addIssue({code:"custom",message:"招募费用须递增且在灵粮最大容量内可支付"});
  for (const job of rules.jobs) {
    if(job.unlockMap!==({spiritGrain:1,spiritWood:1,darkIron:1,spiritCrystal:2,gengJing:3}[job.code]))
      context.addIssue({code:"custom",message:"1.0 岗位解锁条件不可改变"});
    if(job.storage[0].upgradeWood!=="0")context.addIssue({code:"custom",message:"初始储量不收取升级费用"});
    if(wood&&job.storage.some((s,i)=>i>0&&BigInt(s.upgradeWood)>BigInt(wood.storage[job.code==="spiritWood"?i-1:4].capacity)))
      context.addIssue({code:"custom",message:"储量升级费用超过可达到的灵木容量"});
    if (rules.schemaVersion === 3 ? (job.output !== "1" || job.cycles !== 1) : (BigInt(job.output) === BigInt(0) || job.cycles !== (job.code === "gengJing" ? 2 : 1)))
      context.addIssue({ code: "custom", message: `${job.code} 产量或周期非法；新规则要求每人每周期产出 1 个` });
    if (job.upkeep !== (job.code === "spiritGrain" ? "0" : "2"))
      context.addIssue({ code: "custom", message: "1.0 维护只能是灵粮 0 / 非粮 2" });
    if (job.storage.some((s, i) => BigInt(s.capacity) === BigInt(0) || (i > 0 && BigInt(s.capacity) <= BigInt(job.storage[i - 1].capacity))))
      context.addIssue({ code: "custom", message: `${job.code} 容量必须递增` });
  }
});
export type ProductionRules = z.infer<typeof rulesSchema>;
const storage = (capacities: number[], costs: number[]) => capacities.map((capacity, i) => ({ capacity: String(capacity), upgradeWood: String(costs[i]) }));
// 1.0 后勤分册 §3 的独立基线；不覆盖 demo_d0，不冒充已发布配置。
export const legacyBaselineRules: ProductionRules = rulesSchema.parse({
  schemaVersion: 2, releaseId: "v1_0-production-baseline-20260915", initialWorkers: 6, maxWorkers: 12,
  offlinePolicy: "unbounded", cyclesMs: [30000, 25000, 20000], recruitCosts: [300,450,650,900,1200,1600].map(String),
  jobs: [
    { code: "spiritGrain", output: "12", cycles: 1, upkeep: "0", unlockMap: 1, storage: storage([400,800,1600,3200,6000], [0,80,220,600,1600]) },
    { code: "spiritWood", output: "6", cycles: 1, upkeep: "2", unlockMap: 1, storage: storage([300,800,2000,5000,12000], [0,100,300,900,2600]) },
    { code: "darkIron", output: "3", cycles: 1, upkeep: "2", unlockMap: 1, storage: storage([200,500,1200,3000,7000], [0,120,360,1050,3000]) },
    { code: "spiritCrystal", output: "1", cycles: 1, upkeep: "2", unlockMap: 2, storage: storage([100,250,600,1500,3500], [0,160,450,1400,4000]) },
    { code: "gengJing", output: "1", cycles: 2, upkeep: "2", unlockMap: 3, storage: storage([20,50,120,300,700], [0,220,650,1900,5200]) },
  ],
});
// Keep v2 releases readable so historical earnings retain their original rules.
export const currentRulesSchema = rulesSchema.refine(rules => rules.schemaVersion === 3, "请使用每人每周期产出 1 个的新规则").superRefine((rules, context) => {
  rules.recruitCosts.forEach((cost, index) => {
    if (!amountSchema.safeParse(cost).success) return;
    const previous = rules.recruitCosts[index - 1];
    if (BigInt(cost) === BigInt(0) || (index > 0 && amountSchema.safeParse(previous).success && BigInt(cost) <= BigInt(previous))) {
      context.addIssue({code: "custom", path: ["recruitCosts", index], message: `第 ${rules.initialWorkers + index + 1} 人的招募费用须为正整数，且严格高于前一级`});
    }
  });
});
export function singleCycleRules(rules: ProductionRules): ProductionRules {
  return rulesSchema.parse({...rules, schemaVersion: 3, jobs: rules.jobs.map(job => ({...job, output: "1", cycles: 1}))});
}
export const baselineRules = singleCycleRules({...legacyBaselineRules, releaseId: "single-cycle-production-20260916"});

export const simulationInputSchema = z.object({
  workerProgress: z.array(z.object({
    progressPercent:z.number().int().min(0).max(99),gengParity:z.union([z.literal(0),z.literal(1)]),
    maintenancePaid:z.boolean(),
  }).strict()).max(12).optional(),
  balances: z.record(z.enum(assetCodes), amountSchema),
  allocations: z.record(z.enum(assetCodes), z.number().int().min(0).max(12)),
  storageLevels: z.record(z.enum(assetCodes), z.number().int().min(1).max(5)),
  workers: z.number().int().min(6).max(12), dewLevel: z.number().int().min(0).max(2),
  highestMap: z.number().int().min(1).max(4), durationSeconds: z.number().int().min(1).max(31536000),
}).strict().superRefine((v, c) => {
  if(v.workerProgress&&v.workerProgress.length!==v.workers)c.addIssue({code:"custom",message:"个人进度数量必须与杂役总数一致"});
  if (Object.values(v.allocations).reduce((a,b) => a+b, 0) > v.workers)
    c.addIssue({ code: "custom", message: "分配人数超过杂役总数" });
  for (const job of baselineRules.jobs) if (v.allocations[job.code] && v.highestMap < job.unlockMap)
    c.addIssue({ code: "custom", message: `${assetNames[job.code]}尚未解锁` });
});
