import { skillDefinitionSchema, type SkillDefinition, type SkillEffect, type SkillMechanics } from "./config";

const source={document:"Docs/1.0策划案/数值/17_1.0职业技能数值_草案.md",version:"1.0-draft.3"};
type Attribute=NonNullable<SkillDefinition["primaryAttribute"]>;
type Modifier=Extract<SkillEffect,{type:"modifier"}>;
type Atom=SkillMechanics["ai"][number]["anyOf"][number][number];
const f=(a:Attribute,p:number,b?:Attribute,q=0,flat=0)=>({flat,terms:[{attribute:a,percent:p},...(b?[{attribute:b,percent:q}]:[])]});
const mod=(stat:Modifier["stat"],percent:number,durationTicks:number,target:Modifier["target"]="target",statusCode?:string):SkillEffect=>({type:"modifier",stat,percent,durationTicks,target,...(statusCode?{statusCode}:{})});
const taunt=(strength:number,durationTicks:number):SkillEffect=>({type:"taunt",strength,durationTicks});
const stun=(chance:number,durationTicks:number):SkillEffect=>({type:"control",status:"stun",chanceBasisPoints:chance*100,durationTicks,chanceMode:"base_hit"});
const heal:SkillEffect={type:"heal",formula:"skill_coefficients"};
const hits=(count:number,selection:"same_target"|"distinct_then_repeat"|"up_to_distinct_targets"="same_target",repeatedTargetPercent=100,critPerPreviousCrit=0):SkillEffect=>({type:"multi_hit",hits:count,selection,repeatedTargetPercent,critPerPreviousCrit,independentHitAndCrit:true});
const leech=(percent:number,maxHpCapPercent:number):SkillEffect=>({type:"lifesteal",percent,maxHpCapPercent,scope:"whole_cast",basis:"actual_damage"});
const reflect=(percent:number,maxHpCapPercent:number,durationTicks:number):SkillEffect=>({type:"reflect",percent,maxHpCapPercent,durationTicks,basis:"actual_direct_damage_after_mitigation",exclude:["dot","environment"],canCrit:false,canLifesteal:false,triggerHitChains:false});
const races=["ghost","remnant","corpse_puppet"] as const;
const race=(percent:number):SkillEffect=>({type:"race_bonus",raceTags:[...races],percent});
const crit=(percent:number):SkillEffect=>({type:"crit_bonus",percent});
const dot=(statusCode:string,formula:ReturnType<typeof f>,durationTicks:number,maxStacks=1,trigger:"on_hit"|"on_critical"="on_hit",damageKind:"physical"|"magical"="magical",ghostOnly=false):SkillEffect=>({type:"dot",statusCode,formula,durationTicks,maxStacks,trigger,damageKind,intervalTicks:20,stacksAdded:1,refreshDuration:true,canCrit:false,...(ghostOnly?{raceTags:[...races]}:{})});
const swordDot=(mastery:boolean)=>dot("sword_sha",f("strength",mastery?11:8,"technique",mastery?6:5),mastery?120:100,mastery?7:5,"on_critical","physical");
const slow=(chance:number,percent:number,durationTicks:number):SkillEffect=>({type:"conditional_slow",minimumDistinctTargetsHit:2,chanceBasisPoints:chance*100,chanceMode:"base_hit",rollScope:"once_per_cast",target:"all_living_enemies",speedPercent:-percent,durationTicks});
const mark=(percent:number):SkillEffect=>({type:"mark",statusCode:"thunder_mark",durationTicks:100,maxStacks:3,stacksPerHit:1,damageTag:"lightning",damageTakenPercentPerStack:percent,refreshOnHit:true});
const puppet=(mastery:boolean):SkillEffect=>({type:"summon",summonCode:"myriad_puppet",hp:f("magic",mastery?280:250,"resistance",mastery?340:300,mastery?160:120),durationTicks:mastery?200:180,tauntStrength:mastery?190:160,tauntDurationTicks:mastery?120:100,temporaryHpPercent:100,damageOrder:["temporary_hp","hp"],recastWhileAlive:"taunt_only",expiresWithTemporaryHp:true,statsSource:"caster"});
const atom=(metric:Atom["metric"],operator:Atom["operator"],value:number,reference?:string):Atom=>({metric,operator,value,...(reference?{reference}:{})});
const always=atom("always","eq",1);
const ai=(priority:number,anyOf:Atom[][]=[[always]],targetSelector:SkillMechanics["ai"][number]["targetSelector"]=null)=>({priority,anyOf,targetSelector});
const stat=(interval:number,cooldown:number,a:Attribute|null=null,p=0,b:Attribute|null=null,q=0)=>({baseIntervalTicks:interval,castTicks:0,cooldownTicks:cooldown,primaryAttribute:a,primaryPercent:p,secondaryAttribute:b,secondaryPercent:q});
type Stats=ReturnType<typeof stat>;
const stage=(stats:Stats,effects:SkillEffect[],tags:SkillMechanics["tags"]=[])=>({...stats,effects,tags});
function s(code:string,name:string,kind:SkillDefinition["damageKind"],target:SkillDefinition["targetType"],base:ReturnType<typeof stage>,mastery:ReturnType<typeof stage>|null=null,aiRules:SkillMechanics["ai"]=[]) {
  const {effects,tags,...stats}=base;
  return skillDefinitionSchema.parse({code,name,damageKind:kind,targetType:target,ignoreTaunt:false,...stats,mechanics:{schemaVersion:1,source,effects,tags,mastery,ai:aiRules}});
}

export const skillContent:SkillDefinition[]=[
  s("skill_chan_fumo","伏魔掌","physical","ENEMY_SINGLE",stage(stat(24,0,"strength",95,"constitution",30),[mod("damage_dealt",-8,60)])),
  s("skill_chan_taunt","金刚怒目","none","SELF",stage(stat(28,120),[taunt(130,100),mod("damage_taken",-10,100,"self"),mod("armor",8,100,"self"),mod("resistance",8,100,"self")])),
  s("skill_chan_iron","铁衣禅","none","SELF",stage(stat(26,160),[mod("damage_taken",-12,120,"self"),mod("control_resistance",15,120,"self")])),
  s("skill_five_strike","五行灵击","magical","ENEMY_SINGLE",stage(stat(22,0,"magic",115,"technique",25),[])),
  s("skill_five_wave","术式震荡","magical","ENEMY_ALL",stage(stat(34,140,"magic",65,"technique",20),[mod("resistance",-8,80)])),
  s("skill_five_restore","五行归元","none","ALLY_ALL",stage(stat(32,150,"magic",34,"technique",12),[heal,mod("technique",5,80)])),
  s("skill_talisman_blade","飞符化刃","magical","ENEMY_SINGLE",stage(stat(23,0,"magic",105,"technique",25),[])),
  s("skill_talisman_restore","回元灵符","none","ALLY_ALL",stage(stat(32,150,"magic",38,"resistance",18),[heal])),
  s("skill_talisman_guard","护神金符","none","ALLY_ALL",stage(stat(30,140),[mod("resistance",10,100),mod("status_resistance",8,100)])),
  s("skill_sword_flying","飞剑点星","physical","ENEMY_SINGLE",stage(stat(20,0,"strength",105,"technique",30),[],["ignore_flying_penalty"])),
  s("skill_sword_split","剑光分化","physical","ENEMY_RANDOM_MULTI",stage(stat(29,100,"strength",65,"technique",20),[hits(2,"distinct_then_repeat",80)])),
  s("skill_sword_nurture","养剑诀","none","SELF",stage(stat(24,160),[mod("technique",12,100,"self"),mod("crit_chance",8,100,"self"),mod("haste",15,100,"self")])),
  s("skill_guard_roar","狮吼震心","none","SELF",stage(stat(27,120),[taunt(170,120),mod("damage_taken",-16,120,"self"),mod("armor",12,120,"self"),mod("resistance",12,120,"self")]),stage(stat(25,110),[taunt(200,140),mod("damage_taken",-22,140,"self"),mod("armor",18,140,"self"),mod("resistance",18,140,"self")]),[ai(0,[[atom("self_has_status","eq",0,"taunt")]])]),
  s("skill_guard_seal","镇狱掌印","physical","ENEMY_SINGLE",stage(stat(25,80,"strength",85,"constitution",35),[mod("damage_dealt",-12,80),stun(35,24)]),stage(stat(23,70,"strength",105,"constitution",45),[mod("damage_dealt",-16,100),stun(45,28)]),[ai(2,[[always]],"ENEMY_HIGH_THREAT")]),
  s("skill_guard_reflect","金轮反照","none","SELF",stage(stat(26,160),[reflect(35,20,120)]),stage(stat(24,145),[reflect(50,25,140)]),[ai(1,[[atom("self_has_status","eq",0,"reflect")]])]),
  s("skill_demon_open","魔纹开体","none","SELF",stage(stat(23,150),[mod("damage_dealt",20,120,"self","demon_open"),mod("crit_chance",10,120,"self"),mod("resistance",-10,120,"self")]),stage(stat(21,135),[mod("damage_dealt",28,140,"self","demon_open"),mod("crit_chance",15,140,"self"),mod("resistance",-8,140,"self")]),[ai(1,[[atom("self_has_status","eq",0,"demon_open")]])]),
  s("skill_demon_multi","三相轰杀","physical","ENEMY_SINGLE",stage(stat(26,80,"strength",48,"constitution",12),[hits(3)]),stage(stat(24,70,"strength",43,"constitution",14),[hits(4)]),[ai(2)]),
  s("skill_demon_drain","吞元炼血","physical","ENEMY_ALL",stage(stat(34,130,"strength",58,"constitution",20),[leech(55,30)]),stage(stat(31,115,"strength",75,"constitution",25),[leech(70,40)]),[ai(0,[[atom("self_hp_percent","lt",60)]])]),
  s("skill_thunder_mark","引雷落印","magical","ENEMY_SINGLE",stage(stat(20,0,"magic",135,"technique",35),[mark(8)],["lightning"]),stage(stat(19,0,"magic",155,"technique",50),[mark(12)],["lightning"]),[ai(2)]),
  s("skill_thunder_chain","雷链追身","magical","ENEMY_RANDOM_MULTI",stage(stat(30,100,"magic",65,"technique",20),[hits(3,"up_to_distinct_targets"),slow(35,15,80)],["lightning"]),stage(stat(28,90,"magic",78,"technique",25),[hits(3,"up_to_distinct_targets"),slow(45,20,100)],["lightning"]),[ai(1,[[atom("enemy_count","gte",2)]])]),
  s("skill_thunder_restore","雷泽回元","none","ALLY_ALL",stage(stat(33,150,"magic",42,"technique",15),[heal,mod("technique",6,80)]),stage(stat(31,130,"magic",55,"technique",20),[heal,mod("technique",8,100)]),[ai(0,[[atom("party_average_hp_percent","lt",65)]])]),
  s("skill_illusion_beguile","镜花惑心","magical","ENEMY_SINGLE",stage(stat(22,0,"magic",90,"technique",35),[mod("damage_dealt",-8,80),mod("accuracy",-10,80),mod("status_resistance",-8,80)]),stage(stat(21,0,"magic",110,"technique",45),[mod("damage_dealt",-12,100),mod("accuracy",-15,100),mod("status_resistance",-12,100)]),[ai(2)]),
  s("skill_illusion_dot","蜃雾蚀神","magical","ENEMY_ALL",stage(stat(34,130,"magic",45,"technique",20),[dot("illusion_mist",f("magic",16,"technique",8),100,3)]),stage(stat(32,115,"magic",55,"technique",25),[dot("illusion_mist",f("magic",20,"technique",10),120,3)]),[ai(1,[[atom("enemy_count","gte",2)]])]),
  s("skill_illusion_drain","夺念还元","magical","ENEMY_MOST_DEBUFFS",stage(stat(29,110,"magic",95,"technique",35),[{type:"debuff_bonus",percentPerDebuff:8},leech(70,30)]),stage(stat(27,95,"magic",125,"technique",45),[{type:"debuff_bonus",percentPerDebuff:12},leech(90,40)]),[ai(0,[[atom("self_hp_percent","lt",60),atom("target_debuff_count","gte",2)]],"ENEMY_MOST_DEBUFFS")]),
  s("skill_ghost_treasure","镇幽符宝","magical","ENEMY_SINGLE",stage(stat(23,0,"magic",105,"technique",35),[race(35)]),stage(stat(22,0,"magic",130,"technique",45),[race(55)]),[ai(2)]),
  s("skill_ghost_array","诛邪符阵","magical","ENEMY_ALL",stage(stat(35,140,"magic",55,"technique",25),[race(30),dot("talisman_fire",f("magic",10),60,1,"on_hit","magical",true)]),stage(stat(33,120,"magic",70,"technique",30),[race(45),dot("talisman_fire",f("magic",15),80,1,"on_hit","magical",true)]),[ai(1,[[atom("ghost_enemy_count","gte",2)]])]),
  s("skill_ghost_restore","安魂回元箓","none","ALLY_ALL",stage(stat(32,150,"magic",58,"resistance",25),[heal,mod("resistance",10,100)]),stage(stat(30,130,"magic",70,"resistance",30),[heal,mod("resistance",14,120)]),[ai(0,[[atom("party_average_hp_percent","lt",70)],[atom("ally_min_hp_percent","lt",40)]])]),
  s("skill_myriad_arrow","破灵符矢","magical","ENEMY_SINGLE",stage(stat(22,0,"magic",120,"technique",35),[mod("resistance",-10,80)]),stage(stat(21,0,"magic",145,"technique",45),[mod("resistance",-15,100)]),[ai(2)]),
  s("skill_myriad_restore","六甲增元箓","none","ALLY_LOWEST_HP",stage(stat(30,120,"magic",95,"resistance",40),[heal,mod("armor",18,100)]),stage(stat(28,105,"magic",125,"resistance",50),[heal,mod("armor",25,120)]),[ai(1,[[atom("ally_min_hp_percent","lt",45)]])]),
  s("skill_myriad_puppet","力士符傀","none","SELF",stage(stat(34,180),[puppet(false)]),stage(stat(32,160),[puppet(true)]),[ai(0,[[atom("high_threat_enemy_exists","eq",1),atom("summon_alive","eq",0,"myriad_puppet")]])]),
  s("skill_azure_star","青冥点星","physical","ENEMY_SINGLE",stage(stat(17,0,"strength",105,"technique",40),[crit(15),swordDot(false)],["ignore_flying_penalty"]),stage(stat(15,0,"strength",120,"technique",50),[crit(20),swordDot(true)],["ignore_flying_penalty"]),[ai(2)]),
  s("skill_azure_chase","分光追影","physical","ENEMY_SINGLE",stage(stat(22,80,"strength",45,"technique",18),[hits(3),swordDot(false)]),stage(stat(20,70,"strength",42,"technique",20),[hits(4,"same_target",100,5),swordDot(true)]),[ai(1)]),
  s("skill_azure_dot","剑煞归流","physical","ENEMY_SINGLE",stage(stat(24,100,"strength",110,"technique",40),[{type:"stack_damage",statusCode:"sword_sha",formula:f("strength",25),consumeStacks:false},{type:"refresh_status",statusCode:"sword_sha"},swordDot(false)]),stage(stat(22,85,"strength",130,"technique",50),[{type:"stack_damage",statusCode:"sword_sha",formula:f("strength",30),consumeStacks:false},{type:"refresh_status",statusCode:"sword_sha"},swordDot(true)]),[ai(0,[[atom("target_status_stacks","gte",3,"sword_sha")]])]),
  s("skill_heavy_break","玄岳破甲","physical","ENEMY_SINGLE",stage(stat(34,0,"strength",155,"technique",35),[mod("armor",-18,100,"target","heavy_armor_break")]),stage(stat(32,0,"strength",180,"technique",45),[mod("armor",-25,120,"target","heavy_armor_break")]),[ai(2,[[atom("target_has_status","eq",0,"heavy_armor_break")]]),ai(3)]),
  s("skill_heavy_stun","剑脊震岳","physical","ENEMY_SINGLE",stage(stat(28,80,"strength",70,"constitution",20),[stun(25,24)]),stage(stat(27,70,"strength",85,"constitution",25),[stun(30,28)]),[ai(0,[[atom("enemy_preparing_high_threat_skill","eq",1)]],"ENEMY_HIGH_THREAT")]),
  s("skill_heavy_sweep","横剑断山","physical","ENEMY_ALL",stage(stat(38,140,"strength",80,"constitution",25),[]),stage(stat(36,120,"strength",100,"constitution",30),[]),[ai(1,[[atom("enemy_count","gte",3)]])]),
];

const groups = [
  ["wu_xiu"], ["fa_xiu"], ["yi_xiu"], ["qian_xiu"],
  ["hu_fa_jin_shen","bu_dong_jin_gang"], ["mo_xiang_li_shi","san_xiang_mo_jun"],
  ["lei_fa_shu_shi","jiu_xiao_lei_jun"], ["shen_jing_huan_fa","shen_meng_xuan_jun"],
  ["zhen_you_fu_mai","zhen_hun_fu_jun"], ["wan_xiang_fu_mai","tian_yuan_fu_jun"],
  ["qing_ming_jian_xiu","qing_ming_jian_jun"], ["xuan_yue_jian_xiu","xuan_yue_jian_jun"],
];
export const careerSkillContent = groups.flatMap((careers,index)=>careers.map((career,stage)=>({career,tier:index<4?0:stage+1,skills:skillContent.slice(index*3,index*3+3).map(s=>s.code)})));
