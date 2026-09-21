"use client";
import {X} from "lucide-react";
import type {EnemyDesign,EncounterDesign} from "@/server/domain/encounters/config";
import type {EnemyRuntime} from "@/server/domain/encounters/runtime";
import visualPlan from "@/server/domain/encounters/visual-plan-v1.json";
export type BattleDesignDetail={code:string;name:string}&({kind:"enemy";design:EnemyDesign;runtime?:EnemyRuntime|null;attributes?:Record<string,number>;model?:string|null;portrait?:string|null}|{kind:"encounter";design:EncounterDesign});
export function BattleDesignViewer({value,onClose}:{value:BattleDesignDetail;onClose:()=>void}){
  const visual=value.kind==="enemy" ? visualPlan.enemies[value.code as keyof typeof visualPlan.enemies] : undefined;
  const family=visualPlan.families.find(f=>f.code===visual?.family);
  return <div className="config-modal-backdrop" onMouseDown={onClose}><section className="skill-editor" onMouseDown={e=>e.stopPropagation()}>
    <header><div><span className="section-kicker">{value.design.implementationStatus==="runtime_ready"?"执行配置就绪 · 渠道发布另行审核":"设计草稿 · 未启用"}</span><h2>{value.name}</h2></div><button className="icon-button" aria-label="关闭设计详情" onClick={onClose}><X size={17}/></button></header>
    <div className="skill-form"><div className="span-2" style={{fontSize:13,lineHeight:1.8}}>
      <p>地图 {value.design.mapNumber} · {value.code}</p>
      {value.kind==="enemy"?<>
        {value.attributes&&<><h3>当前基础属性</h3><div className="enemy-attribute-grid">{Object.entries(value.attributes).map(([key,n])=><div key={key}><span>{{level:"等级",hp:"生命",strength:"力道",magic:"术法",technique:"技艺",speed:"速度",constitution:"体质",armor:"护甲",resistance:"抗性"}[key]??key}</span><strong>{n}</strong></div>)}</div><p>模型：{value.model??"未绑定"} · 头像：{value.portrait??"未绑定"}</p></>}
        <p>定位：{value.design.role}；硬控：{value.design.hardControl?"有":"无"}；恢复/复生：{value.design.healer?"有":"无"}</p>
        <p>应对：{value.design.intendedCounterplay}</p>
        {value.runtime&&<><h3>已录入执行参数 · 待整体验收</h3><p>初始行动：{value.runtime.initialActionTimer} tick</p>{value.runtime.periodicShield&&<p>每 {value.runtime.periodicShield.intervalTicks} tick 获得 {value.runtime.periodicShield.amount} 护盾</p>}{value.runtime.physicalHitCounter&&<p>累计 {value.runtime.physicalHitCounter.threshold} 次物理直击反震，倍率 {value.runtime.physicalHitCounter.counterPercent}%；法伤清除 {value.runtime.physicalHitCounter.magicalClearAmount} 层（不超过当前层数）</p>}{value.runtime.forcedShieldThresholds&&<p>生命 {value.runtime.forcedShieldThresholds.join("% / ")}% 强制护盾；护盾量 {value.runtime.forcedShieldAmount}</p>}{value.runtime.allyDamageAuraPercent&&<p>存活时同伴伤害增加 {value.runtime.allyDamageAuraPercent}%</p>}</>}

        {visual&&family&&<><h3>共用模型规划 · 待制作</h3><p>{family.name} · {family.baseModel}（全量6套基础模型）</p><p>材质方向：{family.palette}</p><p>{visual.appearance}</p></>}
        <p>基础行动间隔初值：{value.design.proposedBaseIntervalTicks??"按Boss技能分阶段配置"}</p>
        <h3>新增设计约定</h3><ul>{value.design.proposals.map(p=><li key={p}>{p}</li>)}</ul>
        <h3>原始策划机制</h3><p>{value.design.source.document} · {value.design.source.section}</p>
        <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{value.design.source.text}</pre>
      </>:<>
        <p>区域：{value.design.region}；难度：{{low:"低",medium:"中",high:"高",elite:"精英",boss:"Boss"}[value.design.difficulty]}；推荐等级：{value.design.recommendedLevel}</p>
        <p>战斗目标：{value.design.targetSeconds.join("–")}秒（待实测）</p>
        <h3>编成</h3><ul>{value.design.members.map(m=><li key={m.enemyCode}>{m.enemyCode} × {m.quantity}</li>)}</ul>
        <p>首杀魂晶 {value.design.firstSoulCrystal} / 重复魂晶 {value.design.repeatSoulCrystal}（{value.design.rewardBasis==="source_19"?"原文数值":"新增设计初值"}）</p>
        <p>其他奖励：{value.design.additionalRewards}</p>
        <p>刷新：{value.design.refresh==="never"?"主线Boss不刷新":"下次入山刷新；保留首次完成标记"}</p>
        <p>打法：{value.design.intent}</p><p>前置：{value.design.precondition}</p>
        {value.design.bossSoulCode&&<p>唯一首杀魂魄：{value.design.bossSoulCode}</p>}
        <p>这是遭遇设计稿；当前入口绑定和实际奖励请查看地图页“地图1入口与奖励”。</p>
      </>}
    </div></div>
    <footer><span>这里展示策划草稿；敌人技能、阶段与奖励尚未执行化。</span><button className="secondary-button" onClick={onClose}>关闭</button></footer>
  </section></div>;
}
