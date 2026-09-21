"use client";
import {useEffect,useState} from 'react';
import {LoaderCircle} from 'lucide-react';
import type {ContinuousMap} from '@/server/domain/maps/source';
import type {Map01Loop} from '@/server/domain/encounters/loop';
import styles from './MapInspector.module.css';
const kinds:Record<string,string>={enemy_group:'普通敌人',elite_enemy:'精英敌人',resource:'资源点',landmark_event:'阵灯',story_event:'剧情事件',treasure_chest:'宝箱',dungeon:'洞窟',shortcut:'捷径',boss:'Boss',map_exit:'出口'};
const refreshNames:Record<string,string>={per_expedition:'每次出征刷新',permanent:'按持久状态记录',never:'不刷新'};
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
type Data={source:ContinuousMap;regions:{annotations:{layers:{id:string;label:string;shapes:unknown[]}[]}};status:string;configRevision:number;names:Record<string,string>;encounters:Map01Loop['combat']['encounters']};
export function MapInspector({configSet,maps}:{configSet:string;maps:{code:string;name:string}[]}){
 const [mapCode,setMapCode]=useState(maps[0]?.code??'');
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState(''),[kind,setKind]=useState(''),[query,setQuery]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let current=true;setData(null);setError('');if(!mapCode)return;
  fetch(`/api/admin/config/maps/${mapCode}?configSet=${encodeURIComponent(configSet)}`).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message??'读取地图失败');if(current){setData(d);setSelected(d.source.objects[0]?.id??'');}}).catch(e=>{if(current)setError(e.message);});return()=>{current=false;};
 },[configSet,mapCode,retry]);
 if(!maps.length)return <p className="entity-empty">当前配置集尚无地图。</p>;
 const source=data?.source;
 const rows=source?.objects.filter(o=>(!kind||o.kind===kind)&&`${o.title} ${o.id}`.toLowerCase().includes(query.toLowerCase()))??[];
 const object=source?.objects.find(o=>o.id===selected);
 const choices=Array.isArray(object?.choices)?object.choices.map(record):[];
 const encounterIds=[object?.encounterId,...choices.map(c=>c.startEncounterId)].filter((id):id is string=>typeof id==='string');
 const encounter=data?.encounters.find(e=>encounterIds.includes(e.id));
 return <section className={styles.root} aria-label="地图核对">
  <div className={styles.toolbar}><label>地图<select aria-label="选择地图" value={mapCode} onChange={e=>{setMapCode(e.target.value);setKind('');setQuery('');}}>{maps.map(m=><option key={m.code} value={m.code}>{m.name||m.code}</option>)}</select></label><span>{data?`配置修订 ${data.configRevision} · ${data.status==='active'?'草稿已启用 · 发布另行审核':'导入草稿 · 未启用'}`:'读取中'}</span></div>
  {error?<div role="alert">{error}<button className="secondary-button" onClick={()=>setRetry(v=>v+1)}>重试</button></div>:!source?<p><LoaderCircle className="spin" size={16}/> 正在读取地图…</p>:<>
   <p className={styles.summary}>世界尺寸 {source.worldSize[0]} × {source.worldSize[1]} · 入口 ({source.entryX}, {source.entryY}) · {source.objects.length} 个对象</p>
   <p className={styles.summary}>{data?.regions.annotations.layers.filter(l=>l.shapes.length).map(l=>`${l.label} ${l.shapes.length} 个`).join(' · ')}。坐标原样保留，当前只读核对。</p>
   <div className={styles.layout}>
    <div className={styles.canvas}><h3>对象位置示意</h3><svg viewBox={`0 0 ${source.worldSize[0]} ${source.worldSize[1]}`} aria-label="地图1对象位置" role="group">
      <rect width={source.worldSize[0]} height={source.worldSize[1]} fill="#101c18"/>
      <circle cx={source.entryX} cy={source.entryY} r={16} fill="#a2c59f"/><text x={source.entryX+24} y={source.entryY+8} fill="#a2c59f" fontSize={27}>入口</text>
      {source.objects.map(o=><g key={o.id} role="button" aria-label={`定位${o.title}`} tabIndex={0} onClick={()=>setSelected(o.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(o.id);}}}><title>{o.title} · {kinds[o.kind]??o.kind} ({o.x}, {o.y})</title><circle cx={o.x} cy={o.y} r={selected===o.id?23:15} fill={selected===o.id?'#edd090':o.kind==='resource'?'#67ac8b':o.kind==='boss'?'#d9745e':'#8a9995'} stroke={selected===o.id?'#fff2ce':'#18231e'} strokeWidth={4}/></g>)}
     </svg><p>点击落点查看详情；示意图不代表可行走区域。</p></div>
    <div className={styles.browser}>
     <div className={styles.toolbar}><input aria-label="搜索地图对象" placeholder="搜索名称或编码" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="对象类型" value={kind} onChange={e=>setKind(e.target.value)}><option value="">全部对象</option>{[...new Set(source.objects.map(o=>o.kind))].map(k=><option key={k} value={k}>{kinds[k]??k}</option>)}</select></div>
     <div className={styles.list} role="list" aria-label="地图对象列表">{rows.map(o=><button key={o.id} className={o.id===selected?styles.selected:''} onClick={()=>setSelected(o.id)} aria-pressed={o.id===selected}><strong>{o.title}</strong><span>{kinds[o.kind]??o.kind} · ({o.x}, {o.y})</span><small>{o.id}</small></button>)}{!rows.length&&<p>没有匹配的对象。</p>}</div>
     {object&&<article className={styles.detail} aria-label="地图对象详情"><h3>{object.title}</h3><p>{object.description}</p><p>{kinds[object.kind]??object.kind} · X {object.x} / Y {object.y} · {refreshNames[object.refreshType??'permanent']??object.refreshType}</p>
      {encounter&&<section><h4>当前关联战斗</h4><p>{encounter.members.map(m=>`${data?.names[`enemy.${m.enemyId}.name`]??m.enemyId} ×${m.quantity}`).join('、')}</p><p>首次魂晶 {encounter.firstSoulCrystalReward} / 重复魂晶 {encounter.repeatSoulCrystalReward}</p><RewardSummary value={encounter.loot} names={data?.names??{}}/><RewardSummary value={encounter.firstLoot} names={data?.names??{}} first/>{encounter.equipmentRewards&&<p>首胜装备：{encounter.equipmentRewards.map(r=>`${r.qualityCode==='fa_qi'?'法器':'真宝'} ×${r.quantity}`).join('、')}</p>}<p className={styles.caution}>地点名称与说明保留源文件文案；敌群组成以此处的新版关联配置为准。</p></section>}
      {choices.length>0&&<section><h4>交互选项</h4>{choices.map((choice,index)=><div key={String(choice.id??index)} className={styles.choice}><strong>{String(choice.label??choice.id??'交互')}</strong>{typeof choice.resultText==='string'&&<p>{choice.resultText}</p>}<RewardSummary value={record(choice.effects).rewards} names={data?.names??{}}/><RewardSummary value={record(choice.firstClaimEffects).rewards} names={data?.names??{}} first/><details><summary>查看触发条件与完整效果</summary><pre>{JSON.stringify(choice,null,2)}</pre></details></div>)}</section>}
      <details><summary>完整对象数据（含门禁、状态与奖励）</summary><pre>{JSON.stringify(object,null,2)}</pre></details>
     </article>}
    </div>
   </div>
  </>}
 </section>;
}
function RewardSummary({value,names,first=false}:{value:unknown;names:Record<string,string>;first?:boolean}){
 if(!Array.isArray(value)||!value.length)return null;
 return <ul>{value.map((v,index)=>{const reward=record(v),code=String(reward.itemId??'');const name=names[`item.${code}.name`]??names[`resource.${code}.name`]??String(reward.name??code);return <li key={index}>{first?'首次额外：':''}{name}：{reward.firstAmount!==undefined?`首次 ${reward.firstAmount} / 重复 ${reward.repeatAmount??0}`:`×${reward.amount??1}`}</li>;})}</ul>;
}
