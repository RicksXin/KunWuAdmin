"use client";

import { AdminRail } from "@/components/admin/AdminRail";
import { useCallback,useEffect,useState } from "react";
import { Warehouse, Users, SlidersHorizontal, FlaskConical, ChevronRight } from "lucide-react";
import { assetCodes,assetNames,baselineRules,baselineCatalog,singleCycleRules,currentRulesSchema,type AssetCode,type ProductionRules } from "@/server/domain/resources/rules";
import type { FarmState } from "@/server/domain/resources/settle";
import styles from "./ResourceManager.module.css";
import { ResourceSimulator } from "./ResourceSimulator";

type Snapshot={stateVersion:string;state:FarmState;capacities:Record<AssetCode,string>;rulesSummary:ProductionRules;complete:boolean};
type Config={draft:{revision:number;status:string;rules:ProductionRules};releases:{id:string;effective_at:number;hash:string;rules:ProductionRules}[]};
type Player={id:string;label:string;version:string};
type Entry={id:string;reason:string;at_ms:number;asset_code:AssetCode|null;before_amount:string;after_amount:string;delta:string};
type Pending={path:string;body:unknown;key:string};
type Payload=Snapshot&{error?:{message:string};latestSnapshot?:Snapshot};
async function api<T>(path:string,init?:RequestInit):Promise<T> {
  const response=await fetch(`/api/admin/resources/${path}`,{...init,headers:{"Content-Type":"application/json",...init?.headers}});
  const body=await response.json();if(!response.ok)throw new Error(body.error?.message??"操作失败");return body as T;
}
function differences(before:unknown,after:unknown,path=""): {path:string;before:string;after:string}[] {
  if(JSON.stringify(before)===JSON.stringify(after))return [];
  if(before&&after&&typeof before==="object"&&typeof after==="object"){
    const a=before as Record<string,unknown>,b=after as Record<string,unknown>;
    return [...new Set([...Object.keys(a),...Object.keys(b)])].filter(key=>key!=="releaseId").flatMap(key=>differences(a[key],b[key],path?`${path}.${key}`:key));
  }
  return [{path,before:JSON.stringify(before)??"未设置",after:JSON.stringify(after)??"未设置"}];
}
export function ResourceManager() {
  const [editingResource,setEditingResource]=useState<AssetCode|null>(null);
  const [connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("请连接管理身份"),[tab,setTab]=useState("players");
  const [players,setPlayers]=useState<Player[]>([]),[selected,setSelected]=useState(""),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[entries,setEntries]=useState<Entry[]>([]);
  const [config,setConfig]=useState<Config|null>(null),[draft,setDraft]=useState<ProductionRules>(baselineRules),[configReason,setConfigReason]=useState("");
  const [asset,setAsset]=useState<AssetCode>("spiritGrain"),[mode,setMode]=useState("add"),[amount,setAmount]=useState("10"),[reason,setReason]=useState(""),[pending,setPending]=useState<Pending|null>(null);
  const load=useCallback(async()=>{
    try {await api("session");const [p,c]=await Promise.all([api<{players:Player[]}>("players"),api<Config>("configuration")]);setPlayers(p.players);setConfig(c);setDraft(singleCycleRules(c.draft.rules));setConnected(true);setNotice("已连接 · development 独立资源环境");}
    catch(e){setConnected(false);setNotice((e as Error).message);}
  },[]);
  useEffect(()=>{void load();const saved=sessionStorage.getItem("kw-resource-pending");if(saved){try{setPending(JSON.parse(saved));}catch{sessionStorage.removeItem("kw-resource-pending");}}},[load]);
  function remember(value:Pending|null){setPending(value);if(value)sessionStorage.setItem("kw-resource-pending",JSON.stringify(value));else sessionStorage.removeItem("kw-resource-pending");}
  async function execute(operation:Pending) {
    setBusy(true);remember(operation);setNotice("正在提交…");
    try {
      let body:Payload;
      for(;;) {
        const response=await fetch(`/api/admin/resources/${operation.path}`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":operation.key},body:JSON.stringify(operation.body)});
        body=await response.json();
        if(response.status===202){setNotice("正在恢复离线生产…");await new Promise(resolve=>setTimeout(resolve,100));continue;}
        if(!response.ok){if(response.status<500)remember(null);if(body.latestSnapshot)setSnapshot(body.latestSnapshot);throw new Error(body.error?.message??"操作失败，请恢复原请求");}break;
      }
      setSnapshot(body);remember(null);setNotice("操作完成，已同步服务端状态");
      const id=operation.path.split("/")[1];setSelected(id);setEntries((await api<{entries:Entry[]}>(`players/${id}/ledger`)).entries);
    }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
  }
  async function login(){setBusy(true);try{await api("local-login",{method:"POST",body:"{}"});await load();}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
  async function configAction(action:"save"|"approve"|"publish") {
    if(!config)return;
    if(action === "save" && !draftValidation.success){setNotice(draftErrors.map(issue => issue.message).join("；"));return;}
    setBusy(true);
    try{await api("configuration",{method:"POST",body:JSON.stringify({action,revision:config.draft.revision,...(action==="save"?{rules:draft}:{}),reason:configReason})});await load();setNotice({save:"草稿已保存，原审核已失效",approve:"当前修订已审核",publish:"配置已发布，新收益按生效时间分段"}[action]);}
    catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
  }
  function storageField(index:number,level:number,field:"capacity"|"upgradeWood",value:string){setDraft(d=>({...d,jobs:d.jobs.map((j,i)=>i===index?{...j,storage:j.storage.map((s,n)=>n===level?{...s,[field]:value}:s)}:j)}));}
  function catalogField(index:number,field:"displayName"|"nameKey"|"sourceRef"|"usageRef",value:string){setDraft(d=>({...d,catalog:(d.catalog??baselineCatalog).map((item,i)=>i===index?{...item,[field]:value}:item)}));}
  const reference=config?.releases[0]?.rules??baselineRules;
  const changes=differences({...reference,catalog:reference.catalog??baselineCatalog},{...draft,catalog:draft.catalog??baselineCatalog});
  const draftValidation = currentRulesSchema.safeParse(draft);
  const draftErrors = draftValidation.success ? [] : draftValidation.error.issues;
  const dirty=!!config&&JSON.stringify(draft)!==JSON.stringify(config.draft.rules);
  let after="—";try{if(snapshot&&/^\d+$/.test(amount)){const a=BigInt(amount),b=BigInt(snapshot.state.balances[asset]);after=String(mode==="set"?a:mode==="subtract"?b-a:b+a);}}catch{/* Server validates. */}
  const tabs = [
    { id: "players", name: "玩家资源", detail: "玩家库存、余额调整与资源流水", icon: Users },
    { id: "config", name: "目录与配置", detail: "资源目录、生产规则与版本发布", icon: SlidersHorizontal },
    { id: "simulate", name: "生产模拟", detail: "预演产出、维护消耗与满仓停工", icon: FlaskConical },
  ];
  return <div className={styles.shell}>
    <header className="app-header">
      <div className="brand-lockup"><div className="brand-seal">昆</div><div><strong>昆吾司典</strong><span>KUNWU CONFIG CONSOLE</span></div></div>
      <div className="header-context"><span>资源管理</span><i /><strong>灵源院</strong></div>
      <div className="header-actions"><span className={`status-badge ${connected ? "status-badge--published" : "status-badge--review"}`}>{connected ? "管理身份已连接" : "等待连接"}</span></div>
    </header>
    <div className={styles.workspace}>
      <AdminRail />
      <aside className="config-sidebar">
        <div className="sidebar-heading"><div><span className="section-kicker">RESOURCE MANAGEMENT</span><h2>资源管理</h2></div><Warehouse size={18} /></div>
        <p className="config-sidebar__hint">灵源院 · 生产与库存<br />管理资源规则，追踪每一笔变更。</p>
        <nav className="config-module-list" aria-label="资源管理功能">{tabs.map(({ id, name, detail, icon: Icon }) => <button key={id} className={tab === id ? "is-active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><Icon size={20} /><span><strong>{name}</strong><small>{detail}</small></span><ChevronRight size={14} /></button>)}</nav>
      </aside>
      <main className={styles.root}><div className={styles.content}>
    <header><div><span className="section-kicker">LINGYUAN RESOURCE CONSOLE</span><h1>{tabs.find(item => item.id === tab)?.name}</h1><p>{tabs.find(item => item.id === tab)?.detail}</p></div><Warehouse size={28} /></header>
    <p className={styles.notice} role="status">{notice}</p>
    {!connected?<section><h2>连接管理身份</h2><p>使用本机已配置的开发管理会话，操作仅作用于 development 独立数据。其他环境须使用已认证的管理会话。</p><button disabled={busy} onClick={login}>连接本机开发身份</button></section>:<>
      {pending&&<section><strong>上次请求结果尚未确认</strong><p>继续使用原请求恢复，避免重复调整。</p><button disabled={busy} onClick={()=>execute(pending)}>恢复上次请求</button></section>}
      {tab==="players"&&<>
        <section><h2>选择玩家</h2><div className={styles.playerList}>{players.map(p=><button disabled={busy||!!pending} className={selected===p.id?styles.active:""} key={p.id} onClick={()=>execute({path:`players/${p.id}/sync`,body:{},key:crypto.randomUUID()})}>{p.label}<small>{p.id.slice(0,8)}</small></button>)}</div></section>
        {snapshot&&<><section><h2>当前资源</h2><p>杂役 {snapshot.state.workers.length} 人 · 灵液 {snapshot.state.dewLevel} 级 · 最高地图 {snapshot.state.highestMap} · 状态版本 {snapshot.stateVersion}</p>
          <div className={styles.scroll}><table><thead><tr><th>资源</th><th>余额 / 容量</th><th>储量等级</th><th>岗位人数</th></tr></thead><tbody>{assetCodes.map(code=><tr key={code}><td>{assetNames[code]}</td><td>{snapshot.state.balances[code]} / {snapshot.capacities[code]}</td><td>{snapshot.state.storageLevels[code]}</td><td>{snapshot.state.workers.filter(w=>w.job===code).length}</td></tr>)}</tbody></table></div>
          <fieldset disabled={busy||!!pending}><legend>调整余额</legend><div className={styles.form}>
            <label>资源<select value={asset} onChange={e=>setAsset(e.target.value as AssetCode)}>{assetCodes.map(code=><option key={code} value={code}>{assetNames[code]}</option>)}</select></label>
            <label>方式<select value={mode} onChange={e=>setMode(e.target.value)}><option value="add">增加</option><option value="subtract">扣减</option><option value="set">设置余额</option></select></label>
            <label>数量<input aria-label="调整数量" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="numeric"/></label>
            <label>原因<input aria-label="调整原因" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label>
          </div><p>确认预览：{assetNames[asset]} {snapshot.state.balances[asset]} → {after}；容量 {snapshot.capacities[asset]}。提交时会再次校验最新余额。</p>
          <button disabled={reason.trim().length<2} onClick={()=>execute({path:`players/${selected}/adjust`,key:crypto.randomUUID(),body:{type:"adjust",asset,mode,amount,reason,expectedVersion:snapshot.stateVersion,expectedBalance:snapshot.state.balances[asset]}})}>确认调整</button></fieldset>
        </section><section><h2>最近资源流水</h2><div className={styles.scroll}><table><thead><tr><th>时间</th><th>业务</th><th>资源</th><th>变更前</th><th>增减</th><th>变更后</th></tr></thead><tbody>{entries.filter(e=>e.asset_code).map(e=><tr key={`${e.id}-${e.asset_code}`}><td>{new Date(Number(e.at_ms)).toLocaleString()}</td><td>{({production:"生产结算",adjust:"后台调整",recruit:"杂役招募",storage:"储量升级",reward:"任务奖励"} as Record<string,string>)[e.reason]??e.reason}</td><td>{assetNames[e.asset_code!]}</td><td>{e.before_amount}</td><td>{e.delta}</td><td>{e.after_amount}</td></tr>)}</tbody></table></div></section></>}
      </>}
      {tab === "config" && config && <>
        <section className={styles.configPanel}>
          <div className={styles.panelHeading}><h2>资源目录</h2><span className="status-badge">R{config.draft.revision} · {dirty ? "未保存" : ({draft:"草稿",approved:"已审核",published:"已发布"} as Record<string,string>)[config.draft.status]}</span></div>
          <p>每名工人每周期产出 1 个，岗位产出随在岗人数增加。</p>
          <fieldset disabled={busy} className={styles.flatFieldset}>
            <div className={styles.scroll}><table className={styles.catalogTable}>
              <thead><tr><th>资源名称</th><th>每人产出</th><th>产出周期</th><th>解锁地图</th><th /></tr></thead>
              <tbody>{(draft.catalog ?? baselineCatalog).map((item, i) => {
                const job = draft.jobs[i];
                return <tr key={item.code}>
                  <td><input aria-label={`${assetNames[item.code]}显示名称`} value={item.displayName} maxLength={200} onChange={e => catalogField(i,"displayName",e.target.value)} /></td>
                  <td>{job.output} 个 / 人</td>
                  <td>{job.cycles} 周期</td><td>地图 {job.unlockMap}</td>
                  <td><button aria-expanded={editingResource === item.code} onClick={() => setEditingResource(editingResource === item.code ? null : item.code)}>{editingResource === item.code ? "收起" : "详细设置"}</button></td>
                </tr>;
              })}</tbody>
            </table></div>
            {editingResource && (() => {
              const i = draft.jobs.findIndex(job => job.code === editingResource);
              const job = draft.jobs[i], item = (draft.catalog ?? baselineCatalog)[i];
              return <div className={styles.resourceDetail}>
                <div className={styles.panelHeading}><h3>{item.displayName} · 详细设置</h3><code>{item.code}</code></div>
                <div className={styles.scroll}><table><thead><tr><th>储量等级</th><th>容量上限</th><th>升级费用（灵木）</th></tr></thead><tbody>{job.storage.map((level,n) => <tr key={n}><td>{n+1} 级</td><td><input aria-label={`${assetNames[item.code]}${n+1}级容量`} value={level.capacity} inputMode="numeric" onChange={e => storageField(i,n,"capacity",e.target.value)} /></td><td><input aria-label={`${assetNames[item.code]}${n+1}级费用`} value={level.upgradeWood} inputMode="numeric" disabled={n===0} onChange={e => storageField(i,n,"upgradeWood",e.target.value)} /></td></tr>)}</tbody></table></div>
                <details><summary>名称键与引用信息</summary><div className={styles.metadataFields}>{([["nameKey","名称键"],["sourceRef","来源引用"],["usageRef","用途引用"]] as const).map(([field,label]) => <label key={field}>{label}<input value={item[field]} maxLength={200} onChange={e => catalogField(i,field,e.target.value)} /></label>)}</div><p>图标：{item.iconRef} · 公共仓库 · 已启用</p></details>
              </div>;
            })()}
            <details className={styles.disclosure}><summary>生产规则</summary>
              <p>初始 {draft.initialWorkers} 人，上限 {draft.maxWorkers} 人；灵液周期 {draft.cyclesMs.map(ms => ms/1000).join(" / ")} 秒。除灵粮外，每人每周期消耗 2 灵粮，按上表顺序供给。</p>
            </details>
          </fieldset>
        </section>
        <section>
          <div className={styles.panelHeading}><h2>杂役招募费用</h2><span className={styles.muted}>消耗灵粮 · 逐级递增</span></div>
          <p>初始 {draft.initialWorkers} 人免费；招募第 {draft.initialWorkers + 1}–{draft.maxWorkers} 人时，按对应档位扣除灵粮。后一级费用必须高于前一级。</p>
          <fieldset disabled={busy} className={styles.flatFieldset}>
            <div className={styles.form}>{draft.recruitCosts.map((cost,i) => {
              const error = draftErrors.find(issue => issue.path[0] === "recruitCosts" && issue.path[1] === i);
              return <label key={i}>第 {draft.initialWorkers+i+1} 人<input aria-label={`第${draft.initialWorkers+i+1}人招募灵粮费用`} aria-invalid={!!error} aria-describedby={error ? `recruit-error-${i}` : undefined} value={cost} inputMode="numeric" onChange={e => setDraft(d => ({...d,recruitCosts:d.recruitCosts.map((c,n) => n===i ? e.target.value : c)}))} />{error && <small id={`recruit-error-${i}`} className={styles.fieldError}>{error.message}</small>}</label>;
            })}</div>
          </fieldset>
          {!draftValidation.success && <p role="alert" className={styles.fieldError}>{draftErrors.map(issue => issue.message).join("；")}</p>}
        </section>
        <section className={styles.publishPanel}>
          <div className={styles.panelHeading}><h2>保存与发布</h2><span className={styles.muted}>{changes.length ? `${changes.length} 项变更` : "与最新发布一致"}</span></div>
          <p>保存 → 审核 → 发布。新规则在发布后生效。</p>
          <fieldset disabled={busy} className={styles.flatFieldset}>
            <label>操作说明<input value={configReason} onChange={e => setConfigReason(e.target.value)} placeholder="简述本次变更或审核意见（至少 2 字）" maxLength={500} /></label>
            <div className={styles.actions}>
              <button disabled={configReason.trim().length<2||!draftValidation.success} onClick={() => configAction("save")}>保存草稿</button>
              <button disabled={configReason.trim().length<2||config.draft.status!=="draft"||dirty} onClick={() => configAction("approve")}>审核</button>
              <button disabled={configReason.trim().length<2||config.draft.status!=="approved"||dirty} onClick={() => configAction("publish")}>发布</button>
            </div>
          </fieldset>
          <details className={styles.disclosure}><summary>变更明细与影响 · {changes.length} 项</summary>
            <p>影响当前环境全部玩家。降低容量会使超容量库存停工，已有余额保留；产量和费用调整只影响后续结算。</p>
            {changes.length ? <div className={styles.scroll}><table><thead><tr><th>字段</th><th>已发布</th><th>草稿</th></tr></thead><tbody>{changes.map(change => <tr key={change.path}><td>{change.path}</td><td>{change.before}</td><td>{change.after}</td></tr>)}</tbody></table></div> : <p>暂无变更。</p>}
          </details>
          <details className={styles.disclosure}><summary>发布历史 · {config.releases.length} 个版本</summary>
            {config.releases.map(r => <div className={styles.historyRow} key={r.id}><div><span>{r.effective_at===0 ? "初始基线" : new Date(Number(r.effective_at)).toLocaleString()}</span><small>{r.id}</small></div><button disabled={busy} onClick={() => {setDraft(singleCycleRules({...r.rules,releaseId:draft.releaseId}));setNotice("历史规则已载入，请检查差异后保存、审核并发布");}}>载入</button></div>)}
          </details>
        </section>
      </>}
      {tab==="simulate"&&<ResourceSimulator rules={config?singleCycleRules(config.draft.rules):baselineRules} endpoint="/api/admin/resources/simulate"/>}
    </>}
  </div></main></div><footer className={styles.footer}><span>昆吾司典 · 灵源院</span><span>{connected ? "管理会话已连接" : "管理会话未连接"}</span></footer></div>;
}
