"use client";

import { useState } from "react";
import styles from "./ResourceSimulator.module.css";
import { assetCodes, assetNames, baselineRules, type AssetCode, type ProductionRules } from "@/server/domain/resources/rules";
import type { FarmState, Report } from "@/server/domain/resources/settle";

type Result = {state:FarmState; report:Report; eventCount:number; rulesId:string;statuses:Record<AssetCode,string>};
const initial = {spiritGrain:1,spiritWood:2,darkIron:1,spiritCrystal:1,gengJing:1};
export function ResourceSimulator({rules=baselineRules,endpoint="/api/resources/simulate"}:{rules?:ProductionRules;endpoint?:string}) {
  const [balances,setBalances]=useState<Record<AssetCode,string>>({spiritGrain:"120",spiritWood:"0",darkIron:"0",spiritCrystal:"0",gengJing:"0"});
  const [allocations,setAllocations]=useState(initial);
  const [storageLevels,setLevels]=useState<Record<AssetCode,number>>({spiritGrain:1,spiritWood:1,darkIron:1,spiritCrystal:1,gengJing:1});
  const [workers,setWorkers]=useState(6), [dewLevel,setDew]=useState(0), [highestMap,setMap]=useState(3), [duration,setDuration]=useState(3600);
  const [busy,setBusy]=useState(false), [error,setError]=useState(""), [result,setResult]=useState<Result|null>(null);
  const [progress,setProgress]=useState(Array.from({length:12},()=>({progressPercent:0,gengParity:0 as 0|1,maintenancePaid:false})));
  const assignments=assetCodes.flatMap(code=>Array.from({length:Math.max(0,Math.min(12,allocations[code]||0))},()=>code));
  const inputClass=styles.input;
  async function simulate() {
    setBusy(true); setError(""); setResult(null);
    try {
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({balances,allocations,storageLevels,workers,dewLevel,highestMap,durationSeconds:duration,workerProgress:progress.slice(0,workers)})});
      const payload=await response.json(); if(!response.ok) throw new Error(typeof payload.error==="string"?payload.error:payload.error?.message??"模拟失败"); setResult(payload);
    } catch(e) { setError(e instanceof Error?e.message:"连接失败，请重试"); } finally {setBusy(false);}
  }
  return <div className={styles.root}>
    <div>
      <header>
        <div><p>昆吾 · 资源管理</p><h1>灵源院生产模拟</h1><p>按已确认的 1.0 规则预演产出、维护与满仓停工。模拟不会修改玩家余额。</p></div>
      </header>
      <fieldset disabled={busy}>
        <div>
          <label><span>杂役总数</span><input aria-label="杂役总数" type="number" min={6} max={12} value={workers} onChange={e=>setWorkers(Number(e.target.value))} className={inputClass}/></label>
          <label><span>盗天灵液</span><select aria-label="盗天灵液" value={dewLevel} onChange={e=>setDew(Number(e.target.value))} className={inputClass}>{["未获得 · 30 秒","第一滴 · 25 秒","第二滴 · 20 秒"].map((s,i)=><option key={i} value={i}>{s}</option>)}</select></label>
          <label><span>最高地图进度</span><select aria-label="最高地图进度" value={highestMap} onChange={e=>{const map=Number(e.target.value);setMap(map);setAllocations(v=>({...v,spiritCrystal:map>=2?v.spiritCrystal:0,gengJing:map>=3?v.gengJing:0}));}} className={inputClass}>{[1,2,3,4].map(i=><option key={i} value={i}>地图 {i}</option>)}</select></label>
          <label><span>模拟时长（秒）</span><input aria-label="模拟时长" type="number" min={1} max={31536000} value={duration} onChange={e=>setDuration(Number(e.target.value))} className={inputClass}/></label>
        </div>
        <div><table><thead><tr>{["资源 / 每人产出","当前库存","岗位人数","储量等级","储量上限"].map(s=><th key={s}>{s}</th>)}</tr></thead>
          <tbody>{rules.jobs.map(job=><tr key={job.code}>
            <td><span>{assetNames[job.code]}</span><p>{highestMap<job.unlockMap?`地图 ${job.unlockMap} 解锁`:`${job.output} / ${job.cycles===2?"两":"一"}周期`}</p></td>
            <td><input aria-label={`${assetNames[job.code]}库存`} inputMode="numeric" value={balances[job.code]} onChange={e=>setBalances(v=>({...v,[job.code]:e.target.value}))} className={inputClass}/></td>
            <td><input aria-label={`${assetNames[job.code]}人数`} disabled={highestMap<job.unlockMap} type="number" min={0} max={12} value={allocations[job.code]} onChange={e=>setAllocations(v=>({...v,[job.code]:Number(e.target.value)}))} className={inputClass}/></td>
            <td><select aria-label={`${assetNames[job.code]}储量等级`} value={storageLevels[job.code]} onChange={e=>setLevels(v=>({...v,[job.code]:Number(e.target.value)}))} className={inputClass}>{[1,2,3,4,5].map(i=><option key={i} value={i}>{i} 级</option>)}</select></td>
            <td>{job.storage[storageLevels[job.code]-1].capacity}</td>
          </tr>)}</tbody></table></div>
        <details><summary>个人周期进度与维护状态</summary><p>进度为当前周期的完成百分比；已付维护视为模拟开始前的历史支出，不再次从输入余额扣除。调岗后保留个人进度与庚精余数。</p>
          <table><thead><tr><th>杂役 / 岗位</th><th>进度 %</th><th>庚精成功周期余数</th><th>本周期已付维护</th></tr></thead><tbody>{progress.slice(0,Math.max(0,Math.min(12,workers))).map((p,i)=><tr key={i}><td>{i+1} · {assignments[i]?assetNames[assignments[i]]:"空闲"}</td><td><input aria-label={`杂役${i+1}进度`} type="number" min={0} max={99} value={p.progressPercent} onChange={e=>setProgress(v=>v.map((x,n)=>n===i?{...x,progressPercent:Number(e.target.value)}:x))}/></td><td><select aria-label={`杂役${i+1}庚精余数`} value={p.gengParity} onChange={e=>setProgress(v=>v.map((x,n)=>n===i?{...x,gengParity:Number(e.target.value) as 0|1}:x))}><option value={0}>0</option><option value={1}>1</option></select></td><td><input aria-label={`杂役${i+1}维护已付`} type="checkbox" checked={p.maintenancePaid} onChange={e=>setProgress(v=>v.map((x,n)=>n===i?{...x,maintenancePaid:e.target.checked}:x))}/></td></tr>)}</tbody></table>
        </details>
        <div><span>已分配 {Object.values(allocations).reduce((a,b)=>a+b,0)} / {workers} 人 · 满仓停工免维护</span>
          {[600,3600,86400].map((seconds,i)=><button key={seconds} onClick={()=>setDuration(seconds)}>{["10 分钟","1 小时","24 小时"][i]}</button>)}
          <button onClick={simulate}>{busy?"正在计算…":"开始模拟"}</button>
        </div>
      </fieldset>
      {error&&<p role="alert">{error}</p>}
      {result&&<section aria-label="模拟结果">
        <h2>模拟结果</h2><p>以下结果对应最近一次提交的输入。维护在周期开始扣除，未完成周期可能已有维护支出。</p>
        <div><table><thead><tr>{["资源","总产出","维护消耗","实际入库","溢出","最终库存","结束状态"].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{assetCodes.map(code=><tr key={code}><td>{assetNames[code]}</td><td>{result.report.produced[code]}</td><td>{result.report.upkeep[code]}</td><td>{result.report.stored[code]}</td><td>{result.report.overflow[code]}</td><td>{result.state.balances[code]}</td><td>{result.statuses[code]}</td></tr>)}</tbody></table></div>
      </section>}
    </div>
  </div>;
}
