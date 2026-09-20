import { attributes, type CultivatorMutation } from "./config";
// Draft balance values. Skill effects and attack timing remain separate combat configuration.
const rows = [
 ["wu_xiu","common","行脚禅修","monk_wandering","基础承伤 · 成长普通",[800,800,800,800,800,800,800],["慧行","静山","明川","觉远"]],
 ["wu_xiu","01","金刚禅修","monk_guardian","主防御 · 肉身护体突出 · 力道中上",[1000,1000,1000,750,1400,1400,1100],["石岩","慧山","明岳","静海"]],
 ["wu_xiu","02","降魔禅修","monk_vanquishing","主输出 · 力道突出 · 肉身中上",[1500,1000,1000,1000,1000,850,850],["觉明","法远","慧空","定武"]],
 ["fa_xiu","common","布衣法修","taoist_plain","基础法术 · 成长普通",[800,800,800,800,800,800,800],["陈清","林云","方宁","许安"]],
 ["fa_xiu","01","五行法修","taoist_elemental","主法术输出 · 法力突出",[1000,1400,1100,1000,800,800,1000],["陆清","云舒","玄微","清尘"]],
 ["fa_xiu","02","幻术法修","taoist_mirage","干扰辅助 · 神识遁速突出",[1000,1000,1500,1400,800,800,1100],["叶知微","洛烟","顾听澜","沈映秋"]],
 ["yi_xiu","common","执符散修","talisman_plain","基础治疗辅助 · 成长普通",[800,800,800,800,800,800,800],["周灵","江平","宋真","林素"]],
 ["yi_xiu","01","济世符修","taoist_talisman","治疗辅助 · 抗性增益",[1000,1400,1100,1000,800,800,1300],["白灵","素心","灵溪","知微"]],
 ["yi_xiu","02","护阵符修","talisman_ward","防御嘲讽 · 辅助治疗",[1000,900,1000,750,1600,1600,1200],["许安澜","闻守一","林知衡","宋宁"]],
 ["qian_xiu","common","佩剑散修","swordsman_plain","基础剑术 · 成长普通",[800,800,800,800,800,800,800],["张远","陈舟","林青","沈平"]],
 ["qian_xiu","01","疾风剑修","swordsman_robed","速度快 · 单次输出中低",[850,1000,1200,1600,800,800,1000],["墨言","顾长风","沈青舟","林远"]],
 ["qian_xiu","02","重岳剑修","swordsman_heavy","速度慢 · 力道高 · 单次输出高",[1600,1000,850,650,1200,1200,1000],["岳沉","赵砺","秦山","韩重霄"]],
] as const;
export const initialRoster=["hero_wu_xiu_01","hero_fa_xiu_01","hero_yi_xiu_01","hero_qian_xiu_01"];
export const templateDrafts:Extract<CultivatorMutation,{kind:"hero"}>["value"][]=rows.map(([careerCode,suffix,name,appearanceCode,growthFocus,multipliers,namePool],i)=>({
 code:`hero_${careerCode}_${suffix}`,name,appearanceCode,growthFocus,namePool:[...namePool],
 templateClass:suffix==="common"?"common":"excellent",acquisitionWeight:suffix==="common"?80:10,
 growthModifiers:Object.fromEntries(attributes.map((a,n)=>[a,multipliers[n]])) as Record<typeof attributes[number],number>,
 careerCode,rootCode:careerCode==="qian_xiu"||suffix==="common"?"mixed_root":"pseudo_root",realmCode:"lian_qi",initialLevel:1,portraitAssetKey:"",revision:0,status:"active",sortOrder:i,
}));
