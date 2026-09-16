import type { z } from "zod";
import { assetCodes, baselineRules, MAX_AMOUNT, type AssetCode, type ProductionRules, simulationInputSchema } from "./rules";

type Ratio = [string, string];
const ZERO = BigInt(0), ONE = BigInt(1);
function gcd(a: bigint, b: bigint): bigint { while (b !== ZERO) { const r = a % b; a = b; b = r; } return a; }
function rat(n: bigint, d = ONE): Ratio { if (d <= ZERO || n < ZERO) throw new Error("INVALID_RATIO"); const g = gcd(n,d); return [String(n/g), String(d/g)]; }
const r = (value: number): Ratio => rat(BigInt(value));
const add = (a: Ratio,b: Ratio) => rat(BigInt(a[0])*BigInt(b[1])+BigInt(b[0])*BigInt(a[1]), BigInt(a[1])*BigInt(b[1]));
const sub = (a: Ratio,b: Ratio) => rat(BigInt(a[0])*BigInt(b[1])-BigInt(b[0])*BigInt(a[1]), BigInt(a[1])*BigInt(b[1]));
const mul = (a: Ratio,b: Ratio) => rat(BigInt(a[0])*BigInt(b[0]), BigInt(a[1])*BigInt(b[1]));
const div = (a: Ratio,b: Ratio) => rat(BigInt(a[0])*BigInt(b[1]), BigInt(a[1])*BigInt(b[0]));
const cmp = (a: Ratio,b: Ratio) => { const d = BigInt(a[0])*BigInt(b[1])-BigInt(b[0])*BigInt(a[1]); return d < ZERO ? -1 : d > ZERO ? 1 : 0; };
export type Amounts = Record<AssetCode, string>;
export type Worker = { id: number; job: AssetCode | null; progress: Ratio; gengParity: 0|1; ticket: boolean; paid: boolean };
export type FarmState = {
  time: Ratio; balances: Amounts; storageLevels: Record<AssetCode, number>; workers: Worker[];
  dewLevel: number; highestMap: number; rulesId: string;
};
export type Event = { at: Ratio; asset: AssetCode; before: string; after: string; delta: string; reason: string };
export type Report = { produced: Amounts; upkeep: Amounts; stored: Amounts; overflow: Amounts; events: Event[]; iterations: number };
export const zeroAmounts = (): Amounts => Object.fromEntries(assetCodes.map(c => [c,"0"])) as Amounts;
export const emptyReport = (): Report => ({ produced: zeroAmounts(), upkeep: zeroAmounts(), stored: zeroAmounts(), overflow: zeroAmounts(), events: [], iterations: 0 });
export function createFarm(now = 0, rules = baselineRules): FarmState {
  return { time: r(now), balances: { ...zeroAmounts(), spiritGrain: "120" },
    storageLevels: Object.fromEntries(assetCodes.map(c => [c,1])) as Record<AssetCode,number>,
    workers: Array.from({length:rules.initialWorkers},(_,i) => ({ id:i+1,job:null,progress:r(0),gengParity:0,ticket:false,paid:false })),
    dewLevel:0, highestMap:1, rulesId:rules.releaseId };
}
export function capacity(state: FarmState, code: AssetCode, rules = baselineRules): bigint {
  const item = rules.jobs.find(j => j.code === code)?.storage[state.storageLevels[code]-1];
  if (!item) throw new Error("RULES_UNAVAILABLE"); return BigInt(item.capacity);
}
function change(state: FarmState, report: Report, code: AssetCode, delta: bigint, reason: string) {
  if (delta === ZERO) return;
  const before = state.balances[code], after = BigInt(before)+delta;
  if (after < ZERO || after > MAX_AMOUNT) throw new Error("INVALID_BALANCE");
  state.balances[code] = String(after);
  report.events.push({ at:[...state.time],asset:code,before,after:String(after),delta:String(delta),reason });
}
function tally(amounts: Amounts, code: AssetCode, value: bigint) { amounts[code] = String(BigInt(amounts[code])+value); }
function canRun(state: FarmState, w: Worker, rules: ProductionRules) {
  return w.job !== null && rules.jobs.find(j => j.code === w.job)!.unlockMap <= state.highestMap && BigInt(state.balances[w.job]) < capacity(state,w.job,rules);
}
// Admit all workers at the same job/event as a group; no partial upkeep for that group.
function admit(state: FarmState, report: Report, rules: ProductionRules): Worker[] {
  for (const job of rules.jobs) {
    const group = state.workers.filter(w => w.job === job.code && canRun(state,w,rules) && (!w.ticket || (!w.paid && job.upkeep !== "0")));
    const cost = BigInt(job.upkeep)*BigInt(group.length);
    if (BigInt(state.balances.spiritGrain) < cost) continue;
    if (cost > ZERO) { change(state,report,"spiritGrain",-cost,"maintenance"); tally(report.upkeep,"spiritGrain",cost); }
    for (const w of group) { w.ticket = true; w.paid = w.paid || job.upkeep !== "0"; }
  }
  // Upkeep paid at this same instant may create room in a previously full grain store.
  for (const w of state.workers) if (w.job === "spiritGrain" && canRun(state,w,rules)) w.ticket = true;
  return state.workers.filter(w => w.ticket && canRun(state,w,rules) && (w.job === "spiritGrain" || w.paid));
}

export type Activation = { atMs: number; rules: ProductionRules };
/** Pure, resumable reference engine. Budget limits work, never truncates earned time. */
export function settle(input: FarmState, targetMs: number, initialRules = baselineRules, activations: Activation[] = [], budget = 20000) {
  if (!Number.isSafeInteger(targetMs) || targetMs < 0 || !Number.isSafeInteger(budget) || budget < 1) throw new Error("INVALID_TIME_OR_BUDGET");
  const state = structuredClone(input), report = emptyReport(), target = r(targetMs);
  if (cmp(target,state.time) < 0) throw new Error("TIME_INVALID");
  const changes = [...activations].sort((a,b) => a.atMs-b.atMs);
  if (changes.some((x,i) => !Number.isSafeInteger(x.atMs) || x.atMs < 0 || (i > 0 && x.atMs === changes[i-1].atMs))) throw new Error("INVALID_ACTIVATION");
  let rules = initialRules;
  for (const a of changes) if (cmp(r(a.atMs),state.time) <= 0) rules = a.rules;
  state.rulesId = rules.releaseId;
  while (cmp(state.time,target) < 0 && report.iterations < budget) {
    report.iterations++;
    const active = admit(state,report,rules);
    let next = target;
    const activation = changes.find(a => cmp(r(a.atMs),state.time) > 0);
    if (activation && cmp(r(activation.atMs),next) < 0) next = r(activation.atMs);
    const cycle = r(rules.cyclesMs[state.dewLevel]);
    for (const w of active) {
      const due = add(state.time,mul(sub(r(1),w.progress),cycle));
      if (cmp(due,next) < 0) next = due;
    }
    const elapsed = sub(next,state.time);
    for (const w of active) w.progress = add(w.progress,div(elapsed,cycle));
    state.time = next;
    // Complete simultaneous cycles before evaluating capacity for subsequent starts.
    for (const code of assetCodes) for (const w of active.filter(w => w.job === code && cmp(w.progress,r(1)) === 0).sort((a,b) => a.id-b.id)) {
      const job = rules.jobs.find(j => j.code === code)!;
      w.progress = r(0); w.ticket = false; w.paid = false;
      if (job.cycles === 2) { w.gengParity = w.gengParity === 0 ? 1 : 0; if (w.gengParity === 1) continue; }
      const produced = BigInt(job.output), room = capacity(state,code,rules)-BigInt(state.balances[code]);
      const stored = room <= ZERO ? ZERO : room < produced ? room : produced;
      tally(report.produced,code,produced); tally(report.stored,code,stored); tally(report.overflow,code,produced-stored);
      change(state,report,code,stored,"production");
    }
    if (activation && cmp(state.time,r(activation.atMs)) === 0) { rules = activation.rules; state.rulesId = rules.releaseId; }
  }
  return { state, report, complete:cmp(state.time,target) === 0, targetMs };
}

export type Command =
  | { type:"allocation"; allocations:Record<AssetCode,number> }
  | { type:"recruit" }
  | { type:"storage"; asset:AssetCode }
  | { type:"dew"; level:1|2 }
  | { type:"adjust"; asset:AssetCode; mode:"add"|"subtract"|"set"; amount:string };
/** Caller settles first and performs auth/claims/idempotency in its transaction. */
export function applyCommand(input: FarmState, command: Command, rules = baselineRules) {
  const state = structuredClone(input), report = emptyReport();
  if (command.type === "allocation") {
    let total = 0;
    for (const job of rules.jobs) {
      const n = command.allocations[job.code];
      if (!Number.isInteger(n) || n < 0 || n > rules.maxWorkers) throw new Error("INVALID_ALLOCATION");
      if (n > 0 && state.highestMap < job.unlockMap) throw new Error("RESOURCE_LOCKED"); total += n;
    }
    if (total > state.workers.length) throw new Error("WORKER_LIMIT");
    for (const code of assetCodes) {
      const existing = state.workers.filter(w => w.job === code).sort((a,b) => a.id-b.id);
      for (const w of existing.slice(command.allocations[code])) w.job = null;
    }
    const pool = state.workers.filter(w => !w.job).sort((a,b) => a.id-b.id);
    for (const code of assetCodes) {
      const missing = command.allocations[code]-state.workers.filter(w => w.job === code).length;
      for (let i=0;i<missing;i++) pool.shift()!.job = code;
    }
  } else if (command.type === "recruit") {
    if (state.workers.length >= rules.maxWorkers) throw new Error("WORKER_LIMIT");
    const cost = BigInt(rules.recruitCosts[state.workers.length-rules.initialWorkers]);
    if (BigInt(state.balances.spiritGrain) < cost) throw new Error("INSUFFICIENT_RESOURCE");
    change(state,report,"spiritGrain",-cost,"recruit");
    state.workers.push({id:Math.max(...state.workers.map(w => w.id))+1,job:null,progress:r(0),gengParity:0,ticket:false,paid:false});
  } else if (command.type === "storage") {
    const job = rules.jobs.find(j => j.code === command.asset)!;
    if (!job || state.highestMap < job.unlockMap) throw new Error("RESOURCE_LOCKED");
    const next = job.storage[state.storageLevels[command.asset]];
    if (!next) throw new Error("STORAGE_LIMIT");
    const cost = BigInt(next.upgradeWood);
    if (BigInt(state.balances.spiritWood) < cost) throw new Error("INSUFFICIENT_RESOURCE");
    change(state,report,"spiritWood",-cost,"storage"); state.storageLevels[command.asset]++;
  } else if (command.type === "dew") {
    if (command.level !== state.dewLevel+1 || command.level > 2) throw new Error("INVALID_DEW_LEVEL");
    state.dewLevel = command.level;
  } else {
    if (!assetCodes.includes(command.asset) || !/^(0|[1-9]\d{0,18})$/.test(command.amount)) throw new Error("INVALID_AMOUNT");
    const amount = BigInt(command.amount), before = BigInt(state.balances[command.asset]);
    const next = command.mode === "add" ? before+amount : command.mode === "subtract" ? before-amount : amount;
    if (next < ZERO || next > MAX_AMOUNT || (next > capacity(state,command.asset,rules) && next > before)) throw new Error("INVALID_BALANCE");
    change(state,report,command.asset,next-before,"admin_adjustment");
  }
  return {state,report};
}

/** Simulator inputs use the same worker representation as live settlement. */
export function createSimulation(input:z.infer<typeof simulationInputSchema>,rules=baselineRules) {
  let state=createFarm(0,rules);state.balances=input.balances;state.storageLevels=input.storageLevels;
  state.dewLevel=input.dewLevel;state.highestMap=input.highestMap;
  state.workers=Array.from({length:input.workers},(_,i)=>({id:i+1,job:null,progress:["0","1"],gengParity:0,ticket:false,paid:false}));
  state=applyCommand(state,{type:"allocation",allocations:input.allocations},rules).state;
  input.workerProgress?.forEach((p,i)=>{
    const worker=state.workers[i];worker.progress=rat(BigInt(p.progressPercent),BigInt(100));
    worker.gengParity=p.gengParity;worker.paid=p.maintenancePaid;worker.ticket=p.maintenancePaid;
  });
  return state;
}
export function productionStatus(state:FarmState,rules=baselineRules) {
  return Object.fromEntries(rules.jobs.map(job=>{
    const assigned=state.workers.filter(w=>w.job===job.code);
    const unpaid=assigned.filter(w=>!w.paid).length;
    return [job.code,state.highestMap<job.unlockMap?"未解锁":assigned.length===0?"未分配":BigInt(state.balances[job.code])>=capacity(state,job.code,rules)?"满仓停工":BigInt(state.balances.spiritGrain)<BigInt(job.upkeep)*BigInt(unpaid)?"缺粮暂停":"可生产"];
  }));
}
