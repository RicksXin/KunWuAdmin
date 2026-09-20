/** One shared rank ladder. Codes and order are a game contract, colors are editable. */
export const qualityLevels = [
  {code:"fa_qi",name:"法器",color:"#B8BCB7",sortOrder:0},
  {code:"zhen_bao",name:"真宝",color:"#7BA88C",sortOrder:1},
  {code:"fa_bao",name:"法宝",color:"#77A8CC",sortOrder:2},
  {code:"gu_bao",name:"古宝",color:"#B39BCF",sortOrder:3},
  {code:"tong_tian_ling_bao",name:"通天灵宝",color:"#D5B26C",sortOrder:4},
  {code:"xuan_tian_zhi_bao",name:"玄天之宝",color:"#DC897B",sortOrder:5},
] as const;
export const unifiedQualityScheme={code:"unified",name:"统一品级",category:"all",usageTag:"all",status:"active",sortOrder:0} as const;
export const legacyQualityCodes:Record<string,string>={
  "ingot.common":"fa_qi","ingot.refined":"zhen_bao","ingot.superior":"fa_bao","ingot.precious":"gu_bao","ingot.magic":"tong_tian_ling_bao",
  "resource_pack.inferior":"fa_qi","resource_pack.superior":"zhen_bao","resource_pack.special":"fa_bao","resource_pack.immortal":"gu_bao",
};
