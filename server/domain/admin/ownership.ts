/** UI ownership is independent of compiled transport modules. Keep one business owner per group. */
export const domainViews = {
  skills: {name:'技能',detail:'统一维护技能，修士和敌人按编码引用。',groups:['skills','enemySkills'],modules:['combat']},
  enemies: {name:'敌人',detail:'敌人模板、基础属性与战斗机制；地图通过编组引用。',groups:['enemies'],modules:['combat']},
  maps: {name:'地图',detail:'地图、敌人编组、交互点位置与专属奖励。',groups:['maps','expeditionRules','mapExpeditionRules','objects','placements','encounters','map01Bindings','bossEquipmentRewards','rewardPacks'],modules:['expedition','combat','base']},
  camp: {name:'营地',detail:'建筑与等级；生产、仓储和杂役费用在资源管理维护。',groups:['buildings'],modules:['economy']},
  equipment: {name:'装备模板',detail:'物品系统中的装备生成模板；地图奖励只引用模板与品级。',groups:['equipmentRuntime'],modules:['combat']},
} as const;
export type DomainView = keyof typeof domainViews;
export const businessEntries = [
  {href:'/resources',name:'资源',detail:'生产、仓储与杂役'},
  {href:'/cultivators',name:'修士',detail:'模板、职业、灵根与成长'},
  {href:'/items',name:'物品',detail:'装备、配方与交易行'},
  {href:'/skills',name:'技能',detail:'玩家与敌人技能'},
  {href:'/enemies',name:'敌人',detail:'模板、属性与机制'},
  {href:'/maps',name:'地图',detail:'编组、落点与专属奖励'},
  {href:'/camp',name:'营地',detail:'建筑与等级'},
] as const;
