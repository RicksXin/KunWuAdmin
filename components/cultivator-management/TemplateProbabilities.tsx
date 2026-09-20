"use client";
import { useState } from "react";
import { probabilityBasisPoints,type Catalog } from "@/server/domain/cultivators/config";
import styles from "@/components/resource-management/ResourceManager.module.css";
type Workspace=Catalog&{configSet:string;revision:number};
export function TemplateProbabilities({data,onSaved}:{data:Workspace;onSaved:()=>Promise<unknown>}){
 const [career,setCareer]=useState("");
 const [entries,setEntries]=useState<{code:string;value:string}[]>([]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const total=entries.reduce((n,e)=>n+Math.round(Number(e.value)*100),0);
 const valid=entries.length>0&&entries.every(e=>/^\d+(\.\d{1,2})?$/.test(e.value)&&Number(e.value)<=100)&&total===10000;
 function choose(code:string){setCareer(code);setEntries(probabilityBasisPoints(data.heroes,code).map(e=>({code:e.code,value:(e.basisPoints/100).toFixed(2)})));setMessage("");}
 async function save(){setBusy(true);setMessage("");try{
  const response=await fetch("/api/admin/cultivators",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({configSet:data.configSet,probabilities:{revision:data.revision,careerCode:career,entries:entries.map(e=>({code:e.code,basisPoints:Math.round(Number(e.value)*100)}))}})});
  const body=await response.json();if(!response.ok)throw new Error(body.error?.message??"保存失败");
  setMessage("概率草稿已保存，需审核发布后使用。");
  try{await onSaved();}catch{setMessage("保存成功，刷新失败，请手动刷新后继续编辑。");}
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section><h2>模板获取概率</h2><p>默认渠道：先确定职业，再按以下概率获取模板。可分别设置每个模板，不固定普通与优秀的比例。初始四人不参与随机获取。</p>
 <label>选择职业<select disabled={busy} value={career} onChange={e=>choose(e.target.value)}><option value="">请选择职业</option>{data.careers.filter(c=>c.status==="active"&&data.heroes.some(h=>h.careerCode===c.code&&h.status==="active")).map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
 {career&&<><div className={styles.form}>{entries.map(entry=>{const hero=data.heroes.find(h=>h.code===entry.code)!;return <label key={entry.code}>{hero.name} · {hero.templateClass==="common"?"普通":"优秀"}（%）<input disabled={busy} type="number" min="0" max="100" step="0.01" value={entry.value} onChange={e=>setEntries(entries.map(x=>x.code===entry.code?{...x,value:e.target.value}:x))}/></label>;})}</div><p aria-live="polite">合计：{(total/100).toFixed(2)}% · 必须为100%，0%表示不参与获取。</p><button disabled={busy||!valid} onClick={save}>{busy?"保存中…":"保存该职业概率"}</button></>}
 {message&&<p role="status">{message}</p>}<p>本页保存配置草稿；随机获取流程尚未接入 C 端。停用模板后，其余启用模板会按现有权重重新归一化。</p></section>;
}
