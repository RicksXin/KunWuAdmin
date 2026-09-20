"""Generate reviewable design drafts; never executes SQL or changes live maps."""
import json, re, hashlib
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = (root / 'server/domain/encounters/source-v1.md').read_text()
source_path = 'Docs/1.0策划案/数值/19_1.0敌人与Boss战斗数值_草案.md'
codes = [
 ['m1_rubble_rat','m1_stone_wisp','m1_corpse_scout','m1_array_glow','m1_stone_guard','e1_cracked_guard','e1_banner_corpse'],
 ['m2_jade_corpse','m2_vine','m2_wood_sprite','m2_array_serpent','m2_spell_shadow','e2_reviving_guard','e2_mana_devourer','e2_four_symbols'],
 ['m3_broken_blade','m3_bronze_puppet','m3_treasure_rogue','m3_ghost_soldier','m3_gold_eater','e3_treasure_guard','e3_elder_soul','e3_unstable_sword','e3_furnace_golem'],
 ['m4_silver_corpse','m4_chain_spirit','m4_soul_shadow','m4_demon_beast','m4_rift_form','e4_golden_guard','e4_blackwind_shadow','e4_parasite','e4_jailer','e4_silver_feather'],
]
roles = [
 ['追击残血','周期护盾','尸毒消耗','沉默干扰','高护体承伤','物理反震','同伴增伤旗手'],
 ['尸毒前排','优先控制高速单位','汲取恢复','高速减速','降抗沉默','魂灯复生','反制法术','双免切换'],
 ['追弱多段','周期盾前排','混合攻击与逃跑','恐惧干扰','破盾前排','护罩机制','随机群攻','暴击叠速','过热群攻'],
 ['高护体尸毒','压制法力最高者','无视嘲讽追魂','眩晕狂暴','行动条干扰','护盾吸血','空间错位','寄生恢复','处刑残血','飞行多段'],
]
controls = {1:{3},2:{1,4},3:{3,6},4:{1,2,3}}
healers = {1:set(),2:{2,5,6},3:{5},4:{5,7}}
counters = [
 ['保护残血并优先击杀','法术集中破盾，避免低效零散攻击','稳定恢复并保持定力','优先处理施法者，错开恢复窗口','降甲或法术突破高护体','法术清除反震计数','先击杀旗手解除同伴增益'],
 ['控制尸毒叠加与连战损耗','保护高速输出位或抢先控制','集中伤害越过恢复窗口','优先击杀高速干扰单位','用定力和打断保护恢复位','先破魂灯再击杀本体','物理暴击制造输出窗口','按护罩阶段切换攻击类型'],
 ['保护残血，优先削减多段伤害','集中破盾与稳定续航','控制残血逃跑，兼顾双防','保护低定力队员并优先击杀','避免只依赖护盾，改用减伤与恢复','观察护罩后选择正确伤害类型','保护后排，群疗应对随机多段','控制清除叠速','在过热前破盾延后群攻'],
 ['法术破高护体，维持尸毒恢复','保护主法修与恢复位','保护残血并提高异常抵抗','保留眩晕应对狂暴阶段','提早恢复，避免行动条被推后时断档','法伤破盾消除吸血收益','携定界珠或提前恢复','优先击破寄生核','保留护盾承受处刑','使用飞剑和法术处理飞行'],
]
enemies=[]; rewards={}
for map_number in range(1,5):
 block = re.search(rf'## {map_number+1}\. 地图{map_number}敌人\n(.*?)(?=\n## |\Z)', source,re.S).group(1)
 index=0
 for line in block.splitlines():
  if not line.startswith('|'): continue
  cells=[c.strip() for c in line.split('|')[1:-1]]
  if len(cells)<6:continue
  stat_index=next((i for i,c in enumerate(cells) if re.fullmatch(r'\d+(?:/\d+){6}',c)),None)
  if stat_index is None:continue
  if stat_index==3:level,hp=int(cells[1]),int(cells[2])
  else:level,hp=map(int,cells[1].split('/'))
  name=re.sub(r'`[^`]+`\s*','',cells[0]);code=codes[map_number-1][index]
  explicit=re.search(r'`([^`]+)`',cells[0])
  if explicit:assert explicit.group(1)==code
  rank='normal' if index<5 else 'elite'
  stats=list(map(int,cells[stat_index].split('/')))
  first,repeat=map(int,cells[stat_index+2].split('/'))
  rewards[code]=(first,repeat,cells[stat_index+3])
  design={'schemaVersion':1,'implementationStatus':'design_only','mapNumber':map_number,'role':roles[map_number-1][index],
   'hardControl':index in controls[map_number],'healer':index in healers[map_number],
   'source':{'document':source_path,'section':f'地图{map_number}普通敌人' if rank=='normal' else f'地图{map_number}精英','text':line},
   'intendedCounterplay':counters[map_number-1][index],
   'proposedBaseIntervalTicks':max(20,30-stats[3]//15),
   'proposals':['基础行动间隔为新增设计初值；不覆盖原文已明确的技能I/CD、被动计时和阶段规则。','原文未指定的技能冷却/命中需在执行化时按战斗目标校准。']}
  enemies.append({'code':code,'name':name,'rank':rank,'level':level,'maxHp':hp,'stats':stats,'design':design})
  index+=1
 assert index==len(codes[map_number-1]),(map_number,index)
bosses=[
 ('b1_gate_stone','守门石灵',7,6500,[42,12,24,10,70,48,28],200,'反震、护盾与核心暴露','法术清反震，破金身后集中输出；群疗应对裂地流血'),
 ('b2_corpse_general','封坛尸将',13,12000,[62,42,45,18,90,58,45],700,'魂旗复生、尸毒军阵','优先处理魂旗，维持群疗与定力，减少尸毒叠加'),
 ('b3_four_arm_puppet','四臂铸灵傀',20,26000,[105,88,82,28,150,92,84],1800,'四臂拆解、护罩和复活','先拆守臂或铸臂，保留打断应对回炉和过载'),
 ('b4_silver_wing_avatar','银翅夜叉·尸煞化身',24,45000,[155,120,145,105,220,120,115],4000,'尸毒、飞行、残羽三阶段','群疗应对尸毒，法术与飞剑对空，终阶段先处理残羽'),
]
boss_proposals={
 1:['沿用初始45tick、75%/35%强制金身、破盾暴露80tick；不增加第二Boss。'],
 2:['解决主体+魂旗+2尸兵超出3个可选目标的冲突：魂旗存活时只容纳1尸兵，第二名进入待召队列；魂旗破坏后允许2尸兵。候补不计场上单位，不得行动或产出战利品。'],
 3:['四臂生命独立保留，每次仅暴露2臂供选择，和核心共3个目标；每120tick在存活手臂中轮换暴露对，切换预警20tick；隐藏臂仍执行原技能，不能受到选中伤害。','铸臂复活恢复原臂身份和1000HP，不增加第五只臂；过载时必保证至少1只存活臂可选，全部手臂已毁时由控制核心中断。'],
 4:['严格保留原文三阶段、70%展翅、30%落地和2残羽；阶段三不能逃生，进入战斗前显示提示与确认。'],
}
for m,(code,name,level,hp,stats,soul,role,counter) in enumerate(bosses,1):
 block=re.search(rf'## {m+1}\. 地图{m}敌人\n(.*?)(?=\n## |\Z)',source,re.S).group(1)
 boss_text=block[block.index(f'### {m+1}.3'):].strip()
 enemies.append({'code':code,'name':name,'rank':'boss','level':level,'maxHp':hp,'stats':stats,'design':{'schemaVersion':1,'implementationStatus':'design_only','mapNumber':m,'role':role,'hardControl':m==4,'healer':m in [2,3,4],'source':{'document':source_path,'section':f'地图{m}Boss','text':boss_text},'intendedCounterplay':counter,'proposedBaseIntervalTicks':None,'proposals':boss_proposals[m]}})

# Each integer addresses one of that map's five ordinary templates. Curated compositions,
# not seeded random placement; regions remain design labels until map coordinates are frozen.
groups=[
 [[0],[0,0],[1],[2,0],[1,2],[3,0],[2,2],[4,0],[3,1],[4,2,2,3]],
 [[0],[0,3],[1,0],[2,0],[3,3],[4,0,3],[0,0],[1,2,0],[3,0,3],[4,2,0],[0,0,3],[4,2,0,3]],
 [[0],[1,0],[2,0],[3,1],[4,0],[2,2],[1,0,3],[4,2],[0,0,2],[1,4,3],[2,0],[1,1,2],[4,0,3],[4,1,2,3]],
 [[0],[0,4],[1,0],[3],[4,4],[2,0],[0,0,4],[1,4],[3,0],[2,4,4],[0,4],[3,0,4],[1,0,0],[2,0],[4,4,0],[3,0,0,4]],
]
regions=[
 ['A 入山坡','A 入山坡','B 废营灯坪','B 废营灯坪','C 万修门外坡','D 山腹暗道','D 山腹暗道','E 东壁阵灯台','F 北坡残阵带','F 北坡残阵带'],
 ['A 入口','A 入口','外环玉道','C 木魅庭院','D 力阵庭院','E 雷阵庭院','F 蜃阵庭院','G 神阵庭院','外环玉道','H 封尸地窟','H 封尸地窟','I 封坛区前环路'],
 ['B 山脊交通带','B 山脊交通带','C 昆吾殿外苑','D 元牌密室','E 灵宝阁外台','F 灵宝阁残层','G 中央机关回廊','B 山脊交通带','G 中央机关回廊','H 铸灵堂上层','K 回程断桥','H 铸灵堂上层','I 铸灵堂地宫','I 铸灵堂地宫'],
 ['A 西侧入口臂','B 黑风折返带','C 外环前段','D 定界链臂','C 外环前段','E 封魂间','C 外环前段','F 侧狱支路','G 镇尸链臂','E 封魂间','外环后段','G 镇尸链臂','H 锁魂链臂','祭坛前环路','Boss前整备环路','Boss前整备环路'],
]
elite_regions=[['E 东壁阵灯台','F 北坡残阵带'],['D 力阵庭院','C 木魅庭院','四阵眼汇流'],['E 灵宝阁外台','G 中央机关回廊','H 铸灵堂上层','I 铸灵堂地宫'],['D 定界链臂','F 侧狱支路','E 封魂间','G 镇尸链臂','H 锁魂链臂']]
encounters=[];by_code={e['code']:e for e in enemies}
def encounter(code,name,m,region,sequence,members,difficulty,first,repeat,basis,extra='',boss=False):
 d={'schemaVersion':1,'implementationStatus':'design_only','mapNumber':m,'region':region,'difficulty':difficulty,
 'recommendedLevel':max(by_code[c]['level'] for c in members),'targetSeconds':[90,210] if boss else [45,90] if difficulty=='elite' else [20,45],
 'sequence':sequence,'members':[{'enemyCode':c,'quantity':members.count(c)} for c in dict.fromkeys(members)],
 'firstSoulCrystal':first,'repeatSoulCrystal':repeat,'rewardBasis':basis,'additionalRewards':extra,'rewardState':'pending_asset_and_quality_mapping',
 'refresh':'never' if boss else 'next_expedition','firstClearOnce':True,'revisitRetainsFirstClear':True,
 'mainBossOrdinal':m if boss else None,'bossSoulCode':{2:'item_boss_soul_02_corpse_general',4:'item_boss_soul_04_silver_wing_avatar'}.get(m) if boss else None,
 'intent':'；'.join(dict.fromkeys(by_code[c]['design']['intendedCounterplay'] for c in members)),
 'precondition':('全员结丹，确认阶段三不可逃生' if m==4 else '完成本章Boss前主线；可返回整备') if boss else '按所在区域主线条件开放',
 'source':f'19分册敌人数值；{27+m}分册区域；新增编成/奖励初值见20_敌人与遭遇设计', 'coordinateStatus':'unplaced'}
 encounters.append({'code':code,'name':name,'design':d})
for m,compositions in enumerate(groups,1):
 for i,composition in enumerate(compositions):
  members=[codes[m-1][v] for v in composition]
  first=[24,64,140,220][m-1]+i*[3,6,10,12][m-1]
  repeat=round(first*[.5,.45,.4,.35][m-1])
  difficulty='high' if len(members)==4 else 'low' if len(members)==1 else 'medium'
  encounter(f'enc_m{m}_normal_{i+1:02}',f'地图{m}·{regions[m-1][i]}·敌群{i+1:02}',m,regions[m-1][i],i+1,members,difficulty,first,repeat,'new_design','普通材料按模板来源保留，尚未绑定掉落池；魂晶按整场结算，不按单位相加。')
 for j,c in enumerate(codes[m-1][5:]):
  first,repeat,extra=rewards[c]
  encounter(f'enc_{c}',by_code[c]['name'],m,elite_regions[m-1][j],len(compositions)+j+1,[c],'elite',first,repeat,'source_19',extra+'；首次专属物只发一次。')
 b=bosses[m-1]
 encounter(f'enc_{b[0]}',b[1],m,['G 万修之门','I 封坛区','J 铸灵核心台','镇魔塔Boss场地'][m-1],len(compositions)+len(codes[m-1])-4,[b[0]],'boss',b[5],0,'source_19','全部首杀任务物、材料与装备见敌人Boss来源段落；旧装备品级不直接映射新六档。',True)

assert len(enemies)==38 and len(encounters)==70
result={'sourceHash':hashlib.sha256(source.encode()).hexdigest(),'enemies':enemies,'encounters':encounters}
(root/'server/domain/encounters/content-v1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
doc=['# 敌人与遭遇设计（配置草稿）','','日期：2026-09-18。38种敌人、70个遭遇；保留19分册属性与机制，按新版地图区域重新编组。未设置正式坐标，未启用运行配置。','',
 '## 设计口径','','普通战最多4敌、最多1硬控与1恢复/复生模板；高压战之间安排低/中压战与安全整备区域。精英默认单独出现以突出机制。目标时长为普通20–45秒、精英45–90秒、Boss90–210秒，尚需实际战斗验算。','',
 '普通遭遇魂晶是新增整场初值；每图总量按下表预算核验，绝不叠加敌人模板参考值。精英首杀/重复魂晶沿用19分册，Boss只结算一次。普通与精英重入山刷新，但首次奖励标记跨入山与存档持久保存。装备和特殊材料等待稳定资产与新六档品级校准，未绑定可执行奖励包。','',
 '源表没有明确行动间隔的普通/精英采用max(20,30−floor(速度/15)) tick作为待测基础初值；不覆盖源表技能已有I/CD。这不是已验证的战斗平衡结论。','',
 '## Boss冲突处理与新增设计','','第二Boss：魂旗存活时最多1尸兵，第二名排队；旗毁后最多2尸兵，保证场上不超过3个可选敌方目标。第三Boss：四臂保留各自HP/技能，但轮换暴露2臂，与核心共3个可选目标；每120tick轮换并提前20tick预警。以上是解决源文内部人数冲突的新设计，需实战验收。','']
for m in range(1,5):
 local=[e for e in enemies if e['design']['mapNumber']==m];waves=[e for e in encounters if e['design']['mapNumber']==m]
 doc += [f'## 地图{m}','','| 敌人 | 等级/HP | 力/法/神/速/肉/护/定 | 定位与应对 |','| --- | --- | --- | --- |']
 for e in local:doc.append(f"| {e['name']}（{e['code']}） | {e['level']}/{e['maxHp']} | {'/'.join(map(str,e['stats']))} | {e['design']['role']}；{e['design']['intendedCounterplay']} |")
 doc += ['','| 遭遇 | 区域 | 编成 | 难度 | 首次/重复魂晶 |','| --- | --- | --- | --- | --- |']
 for e in waves:
  d=e['design'];members='、'.join(by_code[x['enemyCode']]['name']+'×'+str(x['quantity']) for x in d['members'])
  doc.append(f"| {e['code']} | {d['region']} | {members} | {d['difficulty']} | {d['firstSoulCrystal']}/{d['repeatSoulCrystal']} |")
 doc += ['',f"首轮战斗魂晶预算：{sum(e['design']['firstSoulCrystal'] for e in waves)}；全部可重复战斗再清一次：{sum(e['design']['repeatSoulCrystal'] for e in waves)}。此处不包含支线、资源副本和章节额外奖励，不保证单次全清即可达到突破等级。",'']
doc+=['## 原始机制与后续执行','','每个敌人的design.source.text保留完整来源行，Boss保留完整阶段段落；design.proposals列出新增提案。数据文件：`server/domain/encounters/content-v1.json`。这些字段属于设计记录，尚未替代skill/enemy_skill中的可执行技能、Boss阶段状态机与奖励发放事务。','', '生成命令：`python3 tools/design-encounters.py`。生成器仅写设计JSON和本文；数据库同步通过独立带审计事务工具执行。','']
doc += ['## 美术类型收口', '', '按用户最新确认，38种敌人复用6套基础模型，普通/精英/高阶通过材质、配色、符纹和特效区分。Boss只增加机制必须的部件和动作。逐怪模型映射与制作预算见 [22_怪物美术复用方案](22_怪物美术复用方案.md)，此规则优先于按每种敌人单独制作模型的假设。', '']
(root/'Docs/20_敌人与遭遇设计.md').write_text('\n'.join(doc))
print(json.dumps({'enemies':len(enemies),'encounters':len(encounters)}))
