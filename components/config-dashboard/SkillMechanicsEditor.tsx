"use client";
import { useState } from "react";
import { mechanicsSchema,type SkillMechanics,type SkillEffect } from "@/server/domain/skills/config";

const names:Record<SkillEffect["type"],string>={modifier:"属性增减",taunt:"嘲讽",control:"眩晕",heal:"治疗",multi_hit:"多段攻击",lifesteal:"伤害转治疗",reflect:"反伤",race_bonus:"种族增伤",debuff_bonus:"减益增伤",mark:"叠层标记",mark_bonus:"标记增伤",dot:"持续伤害",stack_damage:"叠层附加伤害",refresh_status:"刷新状态",conditional_slow:"条件群体减速",crit_bonus:"暴击加成",summon:"召唤符傀"};
export function SkillMechanicsEditor({value,onChange,onValidityChange}:{value:SkillMechanics;onChange:(v:SkillMechanics)=>void;onValidityChange:(valid:boolean)=>void}){
  const [text,setText]=useState(()=>JSON.stringify(value,null,2));
  const [error,setError]=useState("");
  const update=(next:string)=>{
    setText(next);
    try{
      const parsed=mechanicsSchema.parse(JSON.parse(next));
      setError("");onValidityChange(true);onChange(parsed);
    }catch(e){setError(e instanceof SyntaxError?"JSON格式不正确":e instanceof Error?e.message:"效果配置无效");onValidityChange(false);}
  };
  return <section className="span-2">
    <h3>技能效果与精通</h3>
    <p>基础效果：{value.effects.length?value.effects.map(e=>names[e.type]).join("、"):"直接伤害"}</p>
    {value.mastery?<>
      <p>结丹精通：行动 {value.mastery.baseIntervalTicks} tick · 冷却 {value.mastery.cooldownTicks} tick · 主倍率 {value.mastery.primaryPercent}% · 副倍率 {value.mastery.secondaryPercent}%</p>
      <p>精通效果：{value.mastery.effects.length?value.mastery.effects.map(e=>names[e.type]).join("、"):"直接伤害"}。保持同一技能ID。</p>
    </>:<p>炼气过渡技能，筑基时由分支技能替换。</p>}
    <p>自动策略：{value.ai.length?`${value.ai.length} 条，优先级 ${value.ai.map(a=>a.priority).join("、")}（数值小优先）`:"原文未指定炼气默认策略"}</p>
    <details><summary>编辑效果、精通与自动策略</summary>
      <p>时间单位为 tick（20 tick = 1秒）；倍率为百分比，概率为万分比。修改后通过校验才能保存。</p>
      <textarea aria-label="技能效果与精通配置" rows={18} style={{width:"100%",fontFamily:"monospace"}} value={text} onChange={e=>update(e.target.value)} />
    </details>
    {error&&<p role="alert" style={{color:"#db8e7e",whiteSpace:"pre-wrap"}}>效果配置无效：{error}</p>}
    <p>来源：{value.source.version}。当前为后台配置，C端战斗执行器尚未接入。</p>
  </section>;
}
