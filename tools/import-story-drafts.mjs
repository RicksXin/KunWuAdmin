import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const adminRoot = path.dirname(toolsDirectory);
const kunwuRoot = path.resolve(adminRoot, "..", "KunWu");
const planningDirectory = path.join(kunwuRoot, "Docs", "1.0策划案");
const storyDirectory = path.join(planningDirectory, "剧情");
const mapDirectory = path.join(planningDirectory, "地图");

export const sourcePaths = {
  current: path.join(storyDirectory, "20_1.0剧情任务详细剧本_草案.md"),
  outline: path.join(storyDirectory, "24_完整游戏剧情总纲_草案.md"),
  main: path.join(storyDirectory, "25_完整游戏主线详细剧情_草案.md"),
  side: path.join(storyDirectory, "26_完整游戏支线剧情库_草案.md"),
  reward: path.join(storyDirectory, "35_乌婆Boss魂魄与魂器馈赠机制_草案.md"),
  mapFramework: path.join(mapDirectory, "27_完整游戏野外大地图与内容框架_草案.md"),
};

export const sourceLabels = {
  current: "Docs/1.0策划案/剧情/20_1.0剧情任务详细剧本_草案.md",
  outline: "Docs/1.0策划案/剧情/24_完整游戏剧情总纲_草案.md",
  main: "Docs/1.0策划案/剧情/25_完整游戏主线详细剧情_草案.md",
  side: "Docs/1.0策划案/剧情/26_完整游戏支线剧情库_草案.md",
  reward: "Docs/1.0策划案/剧情/35_乌婆Boss魂魄与魂器馈赠机制_草案.md",
  mapFramework: "Docs/1.0策划案/地图/27_完整游戏野外大地图与内容框架_草案.md",
};

const speakerIds = new Map(Object.entries({
  "玩家": "player_seal_bearer",
  "旧日玩家": "player_seal_bearer_past",
  "岑守一": "npc_cen_shouyi",
  "岑守一传讯": "npc_cen_shouyi",
  "岑守一留影": "npc_cen_shouyi_echo",
  "岑守一残影": "npc_cen_shouyi_echo",
  "石岩": "hero_shi_yan",
  "陆清": "hero_lu_qing",
  "白灵": "hero_bai_ling",
  "墨言": "hero_mo_yan",
  "顾南炉": "npc_gu_nanlu",
  "苏七衡": "npc_su_qiheng",
  "乌婆": "npc_wu_po",
  "乌婆传讯": "npc_wu_po",
  "叶观衡": "npc_ye_guanheng",
  "木青萝": "npc_mu_qingluo",
  "木夫人传讯": "npc_madam_mu_echo",
  "叶承安": "npc_ye_chengan",
  "韩枭": "npc_han_xiao",
  "圭灵残念": "spirit_gui_ling",
  "银月回声": "echo_yinyue",
  "珑梦回声": "echo_longmeng",
  "血焰伪影": "shadow_xueyan",
  "元刹": "echo_yuancha",
  "元刹神念": "echo_yuancha",
  "神秘女声": "echo_yuancha",
  "玲珑神念": "echo_linglong_masked",
  "“玲珑神念”": "echo_linglong_masked",
  "商九还": "npc_shang_jiuhuan",
  "卫殊": "npc_wei_shu",
  "裴玄度": "cultivator_pei_xuandu",
  "沈砚秋留影": "echo_shen_yanqiu",
  "沈砚秋残影": "echo_shen_yanqiu",
  "旧阵音": "echo_old_array",
  "残碑": "echo_stele",
  "破损杂音": "echo_broken_noise",
  "模糊人影": "echo_blurred_figure",
  "叶怀川残魂": "spirit_ye_huaichuan",
  "叶家伤员": "npc_ye_wounded_soldier",
  "名册残字": "echo_roster_inscription",
  "残魂": "spirit_unknown",
  "五鬼袋": "object_five_ghost_bag",
  "旁白": "narrator",
}));

const variableLabels = {
  cen_trust: "岑守一信任",
  mu_trust: "木青萝信任",
  ye_evidence: "叶家证据",
  seal_integrity: "封印完整度",
  demonic_taint: "魔气侵蚀",
  saved_gu_nanlu: "救出顾南炉",
  saved_mu_qingluo: "救出木青萝",
  ye_guanheng_exposed: "叶观衡败露",
  party_all_foundation: "全队筑基",
  party_all_core: "全队结丹",
  identity_clues: "身份线索",
  identity_revealed: "身份揭晓",
  identity_record_choice: "身份记录选择",
  ending_evaluation: "1.0结局评价",
  trauma_truth: "十二年前真相",
  self_authorship: "主角自主",
  yuancha_understanding: "元刹理解",
  yuancha_dependence: "元刹依赖",
  true_name_covenant: "真名魔契段数",
  living_covenant: "众生盟约",
  ending_plan: "终局方案",
  ending_result: "终局结果",
  past_core_state: "过去阵心状态",
  marginal_note_authority: "阵外批注执行权",
  wupo_soul_service_available: "乌婆魂魄馈赠开放",
  wupo_boss_soul_claims: "乌婆Boss魂器领取记录",
};

const combatByScene = {
  "M1-05": "守门石灵",
  "M2-06": "封坛尸将",
  "M3-07": "四臂铸灵傀",
  "M4-08": "银翅夜叉·尸煞化身",
};

const mainChapterDefinitions = [
  ["P0", "接掌外营", "现在 · 1.0序章"],
  ["C01", "山门灯灭", "现在 · 1.0第一章"],
  ["C02", "白玉逆阵", "现在 · 1.0第二章"],
  ["C03", "三殿夺宝", "现在 · 1.0第三章"],
  ["C04", "残翅惊塔", "现在 · 1.0第四章与完整游戏衔接"],
  ["DEMO", "1.0通关尾声", "1.0正式版尾声"],
  ["C05", "山未成牢", "过去一"],
  ["C06", "界门初裂", "过去一"],
  ["C07", "旧史生痕", "现在"],
  ["C08", "双魂之夜", "过去二"],
  ["C09", "借我一名", "过去二"],
  ["C10", "万修入山", "现在"],
  ["C11", "封山之日", "过去三"],
  ["C12", "镇魔塔开", "现在 · 三线终战"],
  ["C13", "三种人界", "现在／未来 · 三结局"],
];

const sideChapterDefinitions = [
  ["W1", "岑守一的旧阵簿", "side_cen_ledger_across_ages", "必要的牺牲是否仍需被记录，失败的初心是否还值得继续。"],
  ["W2", "化仙宗遗命", "side_huaxian_reverse_legacy", "后人继承的是遗宝、宗门命令，还是未完成的责任。"],
  ["W3", "失主的本命元牌", "side_gui_ling_earth_oath", "解除奴役之后，如何与仍然危险的异类建立自愿盟约。"],
  ["W4", "阴罗宗的五鬼袋", "side_five_ghosts_last_order", "死者是可使用的材料，还是仍需履行意愿的人。"],
  ["W5", "叶家的两道命令", "side_ye_two_orders", "家族集体罪责之中是否仍保留个人选择。"],
  ["W6", "逆灵者的未竟阵", "side_ancient_reverse_array", "后人是否应继续承担未竟技术的风险。"],
  ["P1", "石岩《谁来承阵》", "companion_shi_yan_bear_the_seal", "自愿牺牲与被当作材料的区别。"],
  ["P2", "陆清《两种灵气》", "companion_lu_qing_two_energies", "理解危险力量与接受危险力量并不是同一件事。"],
  ["P3", "白灵《十三个伤者》", "companion_bai_ling_thirteen_wounded", "救下一个人是否值得让更多人承担风险。"],
  ["P4", "墨言《真相留下谁》", "companion_mo_yan_cost_of_truth", "揭露真相是否可以不顾及真相会杀死谁。"],
  ["END-S", "救世专属·众生同阵", "ending_salvation_living_covenant", "以自愿盟约完成灵魔逆转阵位。"],
  ["END-D", "灭世专属·真名三契", "ending_destruction_three_covenants", "连续主动确认借名、借身与借界。"],
];

const mapNames = {
  map_01: "破禁山麓·万修之门",
  map_02: "白玉广场",
  map_03: "灵宝遗址",
  map_04: "镇魔塔外层",
  map_05: "封魔深层·废阵井",
  map_06: "上古昆吾前庭",
  map_07: "上古归流谷",
  map_08: "逆灵试验场·第一界门",
  map_09: "双魂镜界",
  map_10: "封山阵坪",
  map_11: "枯脉绝地·叠界台",
  map_12: "阴芝园外层",
  map_13: "万修战场·重封营",
  map_14: "黑风回廊",
  map_15: "叶家血祭地宫",
  map_16: "第三节点·界膜裂谷",
};

const chapterMapIds = {
  C01: ["map_01"],
  C02: ["map_02"],
  C03: ["map_03"],
  C04: ["map_04"],
  C05: ["map_06", "map_07", "map_08"],
  C06: ["map_08", "map_07", "map_06"],
  C07: ["map_01", "map_02", "map_08", "map_11"],
  C08: ["map_09"],
  C09: ["map_09"],
  C10: ["map_03", "map_04", "map_12", "map_05", "map_13", "map_14", "map_15", "map_16"],
  C11: ["map_16", "map_10"],
  C12: ["map_05", "map_13", "map_14", "map_15", "map_16"],
};

const chapterTimeline = {
  P0: "现在",
  C01: "现在",
  C02: "现在",
  C03: "现在",
  C04: "现在",
  DEMO: "现在",
  C05: "过去一",
  C06: "过去一",
  C07: "现在",
  C08: "过去二／记忆",
  C09: "过去二／记忆",
  C10: "现在",
  C11: "过去三",
  C12: "现在",
  C13: "现在／未来",
};

const locationTokens = [
  ["封魔深层", "map_05"], ["废阵井", "map_05"],
  ["上古昆吾前庭", "map_06"], ["上古前庭", "map_06"],
  ["归流谷", "map_07"],
  ["逆灵试验场", "map_08"], ["第一界门", "map_08"],
  ["双魂镜界", "map_09"],
  ["封山阵坪", "map_10"],
  ["枯脉绝地", "map_11"], ["叠界台", "map_11"],
  ["阴芝园", "map_12"],
  ["万修战场", "map_13"], ["重封营", "map_13"],
  ["黑风回廊", "map_14"],
  ["血祭地宫", "map_15"],
  ["界膜裂谷", "map_16"], ["第三节点", "map_16"],
  ["灵宝遗址", "map_03"], ["灵宝阁", "map_03"], ["铸灵堂", "map_03"],
  ["镇魔塔外层", "map_04"], ["封魂间", "map_04"],
  ["白玉广场", "map_02"],
  ["破禁山麓", "map_01"], ["万修之门", "map_01"],
];

const sceneMapOverrides = {
  "C05-01": ["map_06"], "C05-02": ["map_06"], "C05-03": ["map_07"],
  "C05-04": ["map_08"], "C05-05": ["map_08"], "C05-06": ["map_07"],
  "C05-07": ["map_07", "map_08"], "C05-08": ["map_07"], "C05-09": ["map_07"],
  "C06-01": ["map_08"], "C06-02": ["map_08"], "C06-03": ["map_08"],
  "C06-04": ["map_08"], "C06-05": ["map_08"], "C06-06": ["map_08"],
  "C06-07": ["map_08"], "C06-08": ["map_08"], "C06-09": ["map_08"],
  "C07-02": ["map_01"], "C07-03": ["map_02", "map_08"], "C07-04": ["map_08"],
  "C07-06": ["map_11"], "C07-07": ["map_11"], "C07-08": ["map_11"],
  "C07-09": ["map_11"], "C07-10": ["map_11"], "C07-11": ["map_11"], "C07-12": ["map_08", "map_11"],
  "C11-01": ["map_16", "map_10"], "C11-02": ["map_10"], "C11-03": ["map_10"],
  "C11-04": ["map_10"], "C11-05": ["map_10"], "C11-06": ["map_10"],
  "C11-07": ["map_10"], "C11-08": ["map_10"], "C11-09": ["map_10"],
  "C11-10": ["map_10"], "C11-11": ["map_10"], "C11-12": ["map_10"], "C11-END": ["map_10"],
  "Q3-02A": ["map_03"],
  "Q3-02B": ["map_03", "map_04"],
  "Q4-02": ["map_03", "map_04"],
  "Q2-02": ["map_02"],
};

function cleanMarkdown(value) {
  return value
    .replace(/<!--.*?-->/gs, "")
    .replace(/  \n/g, "\n")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(value) {
  let hash = 5381;
  for (const character of value) hash = ((hash << 5) + hash) ^ character.codePointAt(0);
  return (hash >>> 0).toString(16);
}

function identifier(value) {
  return value
    .toLowerCase()
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || `item_${stableHash(value)}`;
}

function speakerIdOf(name) {
  const normalized = name.replace(/^“|”$/g, "").trim();
  return speakerIds.get(name) ?? speakerIds.get(normalized) ?? `speaker_${stableHash(normalized)}`;
}

function versionOf(markdown) {
  return markdown.match(/^版本：([^\s]+)/m)?.[1] ?? "story-draft";
}

function headingSections(markdown) {
  const headings = [...markdown.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
    level: match[1].length,
    text: match[2].trim(),
    heading: match[0],
    index: match.index,
    bodyStart: match.index + match[0].length,
  }));
  return headings.map((heading, index) => {
    const next = headings.slice(index + 1).find((item) => item.level <= heading.level);
    const endIndex = next?.index ?? markdown.length;
    return { ...heading, endIndex, body: markdown.slice(heading.bodyStart, endIndex).trim() };
  });
}

function splitParagraphs(body) {
  const paragraphs = [];
  let cursor = 0;
  for (const match of body.matchAll(/\n{2,}/g)) {
    const raw = body.slice(cursor, match.index);
    if (raw.trim()) paragraphs.push({ position: cursor, raw, text: cleanMarkdown(raw) });
    cursor = match.index + match[0].length;
  }
  const raw = body.slice(cursor);
  if (raw.trim()) paragraphs.push({ position: cursor, raw, text: cleanMarkdown(raw) });
  return paragraphs;
}

function extractLabeledField(body, labels) {
  const wanted = Array.isArray(labels) ? labels : [labels];
  for (const label of wanted) {
    const match = body.match(new RegExp(`^${label}：\\s*(.+(?:\\n[ \\t]+.+)*)`, "m"));
    if (match) return cleanMarkdown(match[1]);
  }
  return "";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function mapIdFromNumber(value) {
  const number = Number(value);
  return number >= 1 && number <= 16 ? `map_${String(number).padStart(2, "0")}` : "";
}

function explicitMapIds(text) {
  const ids = [...text.matchAll(/\bmap_(\d{2})\b/gi)].map((match) => mapIdFromNumber(match[1]));
  for (const match of text.matchAll(/地图\s*0?(\d{1,2})(?:\s*[–—-]\s*(?:地图\s*)?0?(\d{1,2}))?/g)) {
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start <= end && end - start <= 15) {
      for (let number = start; number <= end; number += 1) ids.push(mapIdFromNumber(number));
    }
  }
  return unique(ids);
}

function areaFromSource(sourceText, fallback) {
  const coordinate = sourceText.match(/[（(]\s*\d+\s*[,，]\s*\d+\s*[)）]/)?.[0];
  const cleaned = cleanMarkdown(sourceText)
    .replace(/^(?:地点|触发)：/, "")
    .replace(/^进入`?map_\d{2}`?(?:并)?/, "")
    .replace(/[。；].*$/, "")
    .trim();
  if (coordinate && !cleaned.includes(coordinate)) return `${cleaned || fallback} ${coordinate}`;
  return cleaned.slice(0, 72) || fallback;
}

function inferLocationContext({ chapterCode, sourceCode, title, trigger, body }) {
  const declared = extractLabeledField(body, ["地点", "位置", "场景"]);
  const sourceText = declared ? `地点：${declared}` : `触发：${trigger}`;
  const locationCorpus = `${declared}\n${trigger}\n${title}`;
  const isCamp = /(?:回营|归营|营地|议事殿|山外联营|外营(?:中|内|人物|管事)?)/.test(`${declared}\n${trigger}`)
    || chapterCode === "P0"
    || sourceCode === "E-01";
  const timeline = extractLabeledField(body, ["时态"]) || chapterTimeline[chapterCode] || "跨章节／未冻结";

  if (isCamp) {
    const areaName = /议事殿/.test(sourceText) ? "议事殿" : "山外联营";
    return {
      kind: "camp",
      mapIds: [],
      mapNames: ["山外联营"],
      areaName,
      timeline,
      explorationMode: "camp",
      certainty: "explicit",
      sourceText,
    };
  }

  const directIds = explicitMapIds(`${declared}\n${trigger}`);
  const allowed = chapterMapIds[chapterCode] ?? [];
  const namedIds = locationTokens
    .filter(([token]) => locationCorpus.includes(token))
    .map(([, id]) => id);
  const overrideIds = !directIds.length ? (sceneMapOverrides[sourceCode] ?? []) : [];
  let ids = unique(directIds.length ? directIds : overrideIds.length ? overrideIds : namedIds);
  let certainty = directIds.length || (!overrideIds.length && namedIds.length > 0) ? "explicit" : "inferred";

  if (!ids.length && /^(?:W|P|END-)/.test(chapterCode)) {
    const referencedChapters = unique([...`${title}\n${body}`.matchAll(/\b(C\d{2})\b/g)].map((match) => match[1]));
    ids = unique(referencedChapters.flatMap((code) => chapterMapIds[code] ?? []));
    if (ids.length > 1) certainty = "cross-map";
  }

  if (!ids.length && allowed.length === 1) ids = [...allowed];
  else if (!ids.length && allowed.length > 1) {
    ids = [...allowed];
    certainty = "cross-map";
  }

  if (/^(?:W[1-6]|P[1-4])-END$/.test(sourceCode) || /^(?:S|D)-/.test(sourceCode)) {
    return {
      kind: "instance",
      mapIds: [],
      mapNames: ["任务状态结算"],
      areaName: "不对应单一物理地点",
      timeline,
      explorationMode: "performance",
      certainty: "inferred",
      sourceText: `${sourceText}；该条目是任务结果配置，不是地图事件`,
    };
  }

  if (ids.length > 1) {
    return {
      kind: "cross-map",
      mapIds: ids,
      mapNames: ids.map((id) => mapNames[id] ?? id),
      areaName: "跨地图任务链",
      timeline,
      explorationMode: "cross-map",
      certainty: "cross-map",
      sourceText: directIds.length || declared
        ? sourceText
        : `${sourceText}；地图范围按地图27的${chapterCode}章节网络推断`,
    };
  }

  if (ids.length === 1) {
    const isMemory = chapterCode === "C08" || chapterCode === "C09";
    const isProjection = chapterCode === "C05" || chapterCode === "C06" || chapterCode === "C11";
    return {
      kind: isMemory ? "memory" : "field-map",
      mapIds: ids,
      mapNames: ids.map((id) => mapNames[id] ?? id),
      areaName: areaFromSource(sourceText, "区域未细化"),
      timeline,
      explorationMode: isMemory ? "memory" : isProjection ? "projection" : "expedition",
      certainty,
      sourceText: certainty === "inferred"
        ? `${sourceText}；地图按地图27的${chapterCode}章节网络推断`
        : sourceText,
    };
  }

  if (chapterCode === "C13" || /(?:结局|尾声|未来镜头|回看)/.test(`${title}\n${trigger}`)) {
    return {
      kind: "instance",
      mapIds: [],
      mapNames: ["结局演出实例"],
      areaName: areaFromSource(sourceText, "演出实例"),
      timeline,
      explorationMode: "performance",
      certainty: "inferred",
      sourceText: `${sourceText}；演出层级按地图27推断`,
    };
  }

  return {
    kind: "unknown",
    mapIds: [],
    mapNames: [],
    areaName: areaFromSource(sourceText, "地点未冻结"),
    timeline,
    explorationMode: "unknown",
    certainty: "inferred",
    sourceText,
  };
}

function rewardKind(label) {
  if (/(?:灵石|灵晶|魂晶|灵粮)/.test(label)) return "currency";
  if (/配方/.test(label)) return "recipe";
  if (/(?:装备|饰品|法器|魂衣|军魂甲|装备匣)/.test(label)) return "equipment";
  if (/(?:解锁|开放|增益|效率|伤害|支援|回看|图鉴|评价|好感|信任|态度|路线|坐标|线索|权限|阵位|风味|地图\d+|入山整备|自由探索|支线提示|议事殿|灵圃|百宝库)/.test(label)) return "feature";
  if (/(?:真相|回答|理解|认知|承诺|盟约|证词|结局|状态|姓名|阵誓)/.test(label)) return "narrative";
  if (/(?:操作权|通行权|任务目标|任务导航)/.test(label)) return "feature";
  return "item";
}

function rewardTiming(sourceText) {
  if (/(?:回营后|归营后|随后|后续|最终Boss之后|通关后|下一章)/.test(sourceText)) return "delayed";
  if (/(?:若|成功|需持有|条件|可选|依据当前|完成后|每完成)/.test(sourceText)) return "conditional";
  return "immediate";
}

function splitRewardPayload(payload) {
  return payload
    .replace(/，(?:全部|若|通关|回营|归营|后续|并).*$/, "")
    .replace(/(?:，|,)?(?:并|同时)(?:写入|记录|设置|改变|增加|降低|扣除|消耗).*$/, "")
    .split(/、|以及|(?<=\S)[与和](?=\S)/)
    .map((item) => item.replace(/^[：:，,\s]+|[；;，,。\s]+$/g, "").trim())
    .filter((item) => item && !/^(?:无|不|没有|较少|并存档|保存|存档)/.test(item));
}

function makeReward(label, sourceText, prefix) {
  let cleanLabel = cleanMarkdown(label).replace(/^一(?:件|枚|个|份|只|段|组|层)/, "").trim();
  const kind = rewardKind(cleanLabel);
  const quantityMatch = cleanLabel.match(/(?:[x×]\s*)?(\d+)$/);
  const quantity = quantityMatch
    && ["item", "currency", "recipe", "equipment"].includes(kind)
    && !/[+%]/.test(cleanLabel)
    && !/_[a-z0-9_]*\d+$/i.test(cleanLabel)
    ? Number(quantityMatch[1])
    : undefined;
  if (quantity !== undefined) cleanLabel = cleanLabel.slice(0, quantityMatch.index).trim();
  cleanLabel = cleanLabel || cleanMarkdown(label);
  return {
    id: `${prefix}_${stableHash(`${cleanLabel}|${sourceText}`)}`,
    kind,
    label: cleanLabel,
    ...(quantity !== undefined ? { quantity } : {}),
    timing: rewardTiming(sourceText),
    sourceText: cleanMarkdown(sourceText),
  };
}

function dedupeRewards(rewards) {
  const seen = new Set();
  return rewards.filter((reward) => {
    const key = `${reward.kind}|${reward.label}|${reward.quantity ?? ""}|${reward.timing}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractRewardChanges(raw) {
  const rewards = [];
  const costs = [];
  const sourceText = cleanMarkdown(raw);
  if (!sourceText) return { rewards, costs };
  for (const match of sourceText.matchAll(/(?:固定|直接|额外|最低)?(?:获得|得到|取得|发放|给予|解锁|开放)([^；。]+)/g)) {
    const full = match[0];
    if (/^(?:不|未|无)(?:获得|得到|取得|发放)/.test(full)) continue;
    const prefix = sourceText.slice(Math.max(0, (match.index ?? 0) - 4), match.index ?? 0);
    if (/(?:每|当|一旦)$/.test(prefix)) continue;
    for (const item of splitRewardPayload(match[1])) rewards.push(makeReward(item, full, "reward"));
  }
  for (const match of sourceText.matchAll(/(?:^|[，；。])(?:额外|固定|随后|成功后|完成后)?得([^，；。]+)/g)) {
    for (const item of splitRewardPayload(match[1])) rewards.push(makeReward(item, match[0], "reward"));
  }
  for (const match of sourceText.matchAll(/(?:固定|需要|需|将)?(?:消耗|支付|提交|失去|交出|扣除)([^；。]+)/g)) {
    const full = match[0];
    if (/(?:不|无需|不会|不能)(?:再次)?(?:消耗|支付|提交|失去|交出|扣除)/.test(full)) continue;
    for (const item of splitRewardPayload(match[1])) costs.push(makeReward(item, full, "cost"));
  }
  return { rewards: dedupeRewards(rewards), costs: dedupeRewards(costs) };
}

function followUpDialogue(raw, seed) {
  const lines = [];
  for (const [index, match] of [...raw.matchAll(/([^，。；：]{1,18})[：:]\s*[“\"]([^”\"]+)[”\"]/g)].entries()) {
    const speakerName = cleanMarkdown(match[1]).replace(/^.*(?:→|；)/, "").trim();
    if (!speakerName) continue;
    lines.push({
      id: `${identifier(seed)}_followup_${index + 1}`,
      speakerId: speakerIdOf(speakerName),
      speakerName,
      text: match[2].trim(),
    });
  }
  return lines;
}

function bossSoulChanges(sourceCode) {
  if (sourceCode === "M2-06") {
    return {
      rewards: [
        { id: "reward_item_boss_soul_02_corpse_general", kind: "item", label: "封坛尸将魂魄", quantity: 1, timing: "immediate", sourceText: "封坛尸将首杀固定获得唯一关键物 item_boss_soul_02_corpse_general。" },
        { id: "reward_a02_soul_banner_mail", kind: "equipment", label: "封坛军魂甲（上品）", quantity: 1, timing: "delayed", sourceText: "安全回营交给乌婆后固定获得上品封坛军魂甲。" },
      ],
      costs: [{ id: "cost_item_boss_soul_02_corpse_general", kind: "item", label: "封坛尸将魂魄", quantity: 1, timing: "delayed", sourceText: "回营后交给乌婆；兑换失败时恢复魂魄。" }],
    };
  }
  if (sourceCode === "M4-09") {
    return {
      rewards: [
        { id: "reward_item_boss_soul_04_silver_wing_avatar", kind: "item", label: "银翅尸煞魂魄", quantity: 1, timing: "immediate", sourceText: "银翅夜叉·尸煞化身首杀固定获得唯一关键物 item_boss_soul_04_silver_wing_avatar。" },
        { id: "reward_a04_soul_wing_robe", kind: "equipment", label: "银翅魂衣（珍品）", quantity: 1, timing: "delayed", sourceText: "安全回营交给乌婆后固定获得珍品银翅魂衣。" },
      ],
      costs: [{ id: "cost_item_boss_soul_04_silver_wing_avatar", kind: "item", label: "银翅尸煞魂魄", quantity: 1, timing: "delayed", sourceText: "回营后交给乌婆；兑换失败时恢复魂魄。" }],
    };
  }
  return { rewards: [], costs: [] };
}

function parseDialogue(content, sceneKey, blockIndex) {
  return content.split("\n").map((line) => line.trim()).filter(Boolean).map((line, lineIndex) => {
    const separator = line.search(/[：:]/);
    const speakerName = separator > 0 ? line.slice(0, separator).trim() : "旁白";
    const text = separator > 0 ? line.slice(separator + 1).trim() : line;
    return {
      id: `${identifier(sceneKey)}_d${blockIndex + 1}_l${lineIndex + 1}`,
      speakerId: speakerIdOf(speakerName),
      speakerName,
      text,
    };
  });
}

function extractListGroups(body) {
  const lines = body.split("\n");
  const offsets = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }

  const groups = [];
  let inFence = false;
  let group = null;
  let previousContent = "";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      if (group) groups.push(group);
      group = null;
      continue;
    }
    if (inFence) continue;

    const itemMatch = line.match(/^\s*(?:\d+\.|-)\s+(.+)$/);
    if (itemMatch) {
      if (!group) group = { position: offsets[index], items: [], context: previousContent };
      group.items.push(itemMatch[1].trim());
      continue;
    }
    if (group && /^\s{2,}\S/.test(line)) {
      group.items[group.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (group) groups.push(group);
    group = null;
    if (line.trim()) previousContent = cleanMarkdown(line);
  }
  if (group) groups.push(group);
  return groups;
}

function isChoiceContext(context) {
  return /(?:选项|不可逆选择|玩家(?:可|可以)?回答|玩家(?:需要|可以|可)?选择|玩家回应|处理方式|旁路署名|可行方案|最终答案|再次决定|阵外批注内容由玩家选择|三种处理|四种处理)/.test(context);
}

function extractInlineChoiceGroups(body, occupiedPositions) {
  return splitParagraphs(body).flatMap((paragraph) => {
    if (!/^(?:选项|选择|处理方式)：\S/.test(paragraph.text)) return [];
    if (occupiedPositions.some((position) => Math.abs(position - paragraph.position) < paragraph.raw.length + 3)) return [];
    const raw = paragraph.text.replace(/^(?:选项|选择|处理方式)：/, "");
    const items = raw.split(/[；;]/).map((item) => item.trim()).filter(Boolean);
    if (items.length < 2) return [];
    return [{ position: paragraph.position, items, context: paragraph.text.slice(0, paragraph.text.indexOf("：") + 1) }];
  });
}

function extractActionEvents(body) {
  return splitParagraphs(body).filter((paragraph) => {
    if (paragraph.raw.includes("```") || /^\s*(?:\d+\.|-)\s+/.test(paragraph.raw)) return false;
    return /^(?:结算|章节结算|强制结算|揭示)：/.test(paragraph.text)
      || /^无论(?:选择|如何|顺序)/.test(paragraph.text);
  }).map((paragraph) => ({ position: paragraph.position, kind: "action", text: paragraph.raw.trim() }));
}

function combatEvent(body, sourceCode) {
  const explicit = body.match(/^(?:Boss(?:候选)?|Boss战|战斗)：\s*`?([^，。\n`]+)`?/m);
  const combatName = explicit?.[1]?.trim() ?? combatByScene[sourceCode];
  if (!combatName) return null;
  return { position: explicit?.index ?? body.length * 0.7, kind: "combat", combatName };
}

function parseDetailedEvents(body, sceneKey, sourceCode) {
  const events = [];
  let dialogueIndex = 0;
  for (const match of body.matchAll(/```text\s*\n([\s\S]*?)\n```/g)) {
    events.push({ position: match.index, kind: "dialogue", lines: parseDialogue(match[1], sceneKey, dialogueIndex) });
    dialogueIndex += 1;
  }

  const listGroups = extractListGroups(body);
  const choiceGroups = listGroups.filter((group) => isChoiceContext(group.context));
  choiceGroups.push(...extractInlineChoiceGroups(body, listGroups.map((group) => group.position)));
  for (const group of choiceGroups) events.push({ ...group, kind: "choices" });
  events.push(...extractActionEvents(body));
  const combat = combatEvent(body, sourceCode);
  if (combat) events.push(combat);

  const priority = { dialogue: 1, choices: 2, combat: 3, action: 4 };
  return events.sort((a, b) => a.position - b.position || priority[a.kind] - priority[b.kind]);
}

function parseOutlineEvents(body, sceneKey, mode) {
  const events = [];
  let dialogueIndex = 0;
  for (const match of body.matchAll(/```text\s*\n([\s\S]*?)\n```/g)) {
    events.push({ position: match.index, kind: "dialogue", lines: parseDialogue(match[1], sceneKey, dialogueIndex) });
    dialogueIndex += 1;
  }
  for (const group of extractListGroups(body)) {
    if (mode === "outcomes") events.push({ ...group, kind: "choices", context: `${group.context} 不可逆结果` });
    else if (isChoiceContext(group.context)) events.push({ ...group, kind: "choices" });
    else {
      group.items.forEach((item, index) => events.push({
        position: group.position + index / 100,
        kind: "action",
        text: item,
      }));
    }
  }
  events.push(...extractActionEvents(body));
  return events.sort((a, b) => a.position - b.position);
}

function parseChoice(raw, context, seed) {
  const cleaned = cleanMarkdown(raw);
  let optionText = cleaned;
  let remainder = "";
  if (cleaned.includes("→")) [optionText, remainder] = cleaned.split(/→(.+)/, 2);
  else if (/^[^：]{1,30}：/.test(cleaned)) [optionText, remainder] = cleaned.split(/：(.+)/, 2);
  optionText = optionText.replace(/[。；]$/, "").trim();
  const effects = remainder ? remainder.split(/[；;]/).map((item) => item.trim()).filter(Boolean) : [];
  const followUpLines = followUpDialogue(remainder, seed);
  const changes = extractRewardChanges(remainder);
  const conditionMatch = cleaned.match(/([a-z][a-z0-9_.]*)\s*(≥|<=|>=|≤|==|>|<)\s*(-?\d+)/i);
  const choiceCategory = /不可逆|二次确认|终局|关键结果/.test(`${context} ${cleaned}`)
    ? "irreversible"
    : /态度/.test(context)
      ? "attitude"
      : "method";
  const nodeKind = conditionMatch || /检定|成功时|成功则/.test(cleaned) ? "check" : "choice";
  return {
    nodeKind,
    data: {
      title: optionText || "未命名选项",
      optionText,
      choiceCategory,
      requiresConfirmation: choiceCategory === "irreversible",
      condition: conditionMatch ? `${conditionMatch[1]} ${conditionMatch[2]} ${conditionMatch[3]}` : undefined,
      checkAttribute: conditionMatch?.[1],
      checkOperator: conditionMatch ? ({ "≥": ">=", "≤": "<=", ">=": ">=", "<=": "<=", "==": "==", ">": ">", "<": "<" })[conditionMatch[2]] : undefined,
      checkValue: conditionMatch ? Number(conditionMatch[3]) : undefined,
      description: remainder || cleaned,
      outcomeText: remainder || "原文未单独写明该选项的即时结果。",
      followUpLines,
      followUpNote: followUpLines.length
        ? `原文配置了 ${followUpLines.length} 句该选项专属对白；播放后回到本组选项的公共后续节点。`
        : /(?:台词|回答|回应|反问|批评|承认|拒绝|依据当前)/.test(remainder)
          ? `原文描述了后续反馈，但没有提供可直接播放的逐字对白：${remainder}`
          : "原文未配置该选项的专属后续对白；保存选择结果后汇流到公共节点。",
      branchBehavior: "merge",
      rewards: changes.rewards,
      costs: changes.costs,
      effects,
      notes: cleaned,
    },
  };
}

function actionData(raw, index) {
  const text = cleanMarkdown(raw);
  const separator = text.indexOf("：");
  const title = separator > 0 && separator < 28
    ? text.slice(0, separator)
    : text.replace(/^`([^`]+)`/, "$1").slice(0, 28) || `剧情步骤 ${index}`;
  const changes = extractRewardChanges(raw);
  return {
    title,
    description: text,
    rewards: changes.rewards,
    costs: changes.costs,
    effects: [...raw.matchAll(/`([^`]+)`/g)].map((match) => match[1]),
  };
}

function buildGraph(sceneKey, displayCode, title, trigger, events, sourceCode) {
  const sceneId = identifier(sceneKey);
  const entryId = `${sceneId}_entry`;
  const nodes = [{
    id: entryId,
    type: "entry",
    position: { x: 60, y: 230 },
    data: { title: "场景入口", description: trigger },
  }];
  const edges = [];
  let frontier = [entryId];
  let column = 1;
  let edgeIndex = 0;
  let dialogueIndex = 0;
  let choiceGroupIndex = 0;
  let actionIndex = 0;
  let combatIndex = 0;

  function connect(sources, target) {
    for (const source of sources) {
      edgeIndex += 1;
      edges.push({ id: `${sceneId}_edge_${edgeIndex}`, source, target, type: "smoothstep" });
    }
  }

  for (const event of events) {
    if (event.kind === "dialogue") {
      dialogueIndex += 1;
      const id = `${sceneId}_dialogue_${dialogueIndex}`;
      const speakers = [...new Set(event.lines.map((line) => line.speakerName))];
      nodes.push({
        id,
        type: "dialogue",
        position: { x: 60 + column * 310, y: 190 },
        data: { title: `对话 · ${speakers.slice(0, 3).join("、")}`, lines: event.lines },
      });
      connect(frontier, id);
      frontier = [id];
      column += 1;
      continue;
    }

    if (event.kind === "choices") {
      choiceGroupIndex += 1;
      const choiceIds = [];
      const spacing = event.items.length > 5 ? 125 : 150;
      const startY = Math.max(30, 260 - ((event.items.length - 1) * spacing) / 2);
      event.items.forEach((raw, itemIndex) => {
        const parsed = parseChoice(raw, event.context, `${sceneKey}_${choiceGroupIndex}_${itemIndex + 1}`);
        const id = `${sceneId}_choice_${choiceGroupIndex}_${itemIndex + 1}`;
        choiceIds.push(id);
        nodes.push({
          id,
          type: parsed.nodeKind,
          position: { x: 60 + column * 310, y: startY + itemIndex * spacing },
          data: parsed.data,
        });
        connect(frontier, id);
      });
      const mergeId = `${sceneId}_merge_${choiceGroupIndex}`;
      nodes.push({
        id: mergeId,
        type: "action",
        position: { x: 60 + (column + 1) * 310, y: 220 },
        data: {
          title: "公共后续",
          description: "本组选项在保存各自结果、播放原文明示的专属对白后，于此继续公共剧情。",
          effects: ["selection.save"],
        },
      });
      connect(choiceIds, mergeId);
      frontier = [mergeId];
      column += 2;
      continue;
    }

    if (event.kind === "action") {
      actionIndex += 1;
      const id = `${sceneId}_action_${actionIndex}`;
      nodes.push({
        id,
        type: "action",
        position: { x: 60 + column * 310, y: 210 },
        data: actionData(event.text, actionIndex),
      });
      connect(frontier, id);
      frontier = [id];
      column += 1;
      continue;
    }

    if (event.kind === "combat") {
      combatIndex += 1;
      const id = `${sceneId}_combat_${combatIndex}`;
      nodes.push({
        id,
        type: "combat",
        position: { x: 60 + column * 310, y: 205 },
        data: {
          title: event.combatName,
          combatId: `combat_${sceneId}`,
          description: `${displayCode}「${title}」关联战斗；精确数值仍待产品化。`,
        },
      });
      connect(frontier, id);
      frontier = [id];
      column += 1;
    }
  }

  const bossChanges = bossSoulChanges(sourceCode);
  if (bossChanges.rewards.length) {
    actionIndex += 1;
    const id = `${sceneId}_action_${actionIndex}`;
    nodes.push({
      id,
      type: "action",
      position: { x: 60 + column * 310, y: 210 },
      data: {
        title: "Boss首杀与乌婆馈赠",
        description: "首杀先结算唯一Boss魂魄；安全回营交给乌婆后，再固定领取对应魂器。兑换失败必须回滚。",
        rewards: bossChanges.rewards,
        costs: bossChanges.costs,
        effects: ["wupo_soul_service_available", "wupo_boss_soul_claims"],
      },
    });
    connect(frontier, id);
    frontier = [id];
    column += 1;
  }

  const endId = `${sceneId}_end`;
  nodes.push({
    id: endId,
    type: "ending",
    position: { x: 60 + column * 310, y: 230 },
    data: { title: "场景结束", description: `${displayCode} · ${title}` },
  });
  connect(frontier, endId);
  return { entryNodeId: entryId, nodes, edges };
}

function sceneDescription(body, fallback) {
  const paragraph = splitParagraphs(body).find((item) => {
    if (/^(?:触发|人物|镜头|时态|建议时长|章节命题|章节核心选择|任务ID候选|主题|主要作用|主要人物|终局职责)：/.test(item.text)) return false;
    if (item.raw.includes("```") || /^\s*(?:\d+\.|-|\|)\s*/.test(item.raw)) return false;
    return item.text.length >= 12;
  });
  return paragraph?.text ?? fallback;
}

function makeScene({ projectId, chapterId, code, sourceCode, title, body, heading, sourceDocument, importedAt, mode = "detailed" }) {
  const sceneKey = `${projectId}_${chapterId}_${code}`;
  const trigger = extractLabeledField(body, ["触发", "解锁时间", "任务出现条件"]) || "跟随前置场景或任务状态触发";
  const people = extractLabeledField(body, ["人物", "主要人物"]);
  const events = mode === "detailed"
    ? parseDetailedEvents(body, sceneKey, sourceCode)
    : parseOutlineEvents(body, sceneKey, mode);
  const dialogueSpeakers = events
    .filter((event) => event.kind === "dialogue")
    .flatMap((event) => event.lines.map((line) => line.speakerName));
  const declaredPeople = people
    ? people.replace(/[。]$/, "").split(/[、，/]/).map((item) => item.trim()).filter(Boolean)
    : [];
  const graph = buildGraph(sceneKey, code, title, trigger, events, sourceCode);
  const chapterCode = chapterId.replace(/^(?:main|side)_/, "").toUpperCase();
  const locationContext = inferLocationContext({ chapterCode, sourceCode, title, trigger, body });
  const extractedChanges = extractRewardChanges(body);
  const bossChanges = bossSoulChanges(sourceCode);
  const canonicalBossPattern = sourceCode === "M2-06"
    ? /(?:封坛尸将魂魄|封坛军魂甲|item_boss_soul_02_corpse_general)/
    : sourceCode === "M4-09"
      ? /(?:银翅尸煞魂魄|银翅魂衣|item_boss_soul_04_silver_wing_avatar)/
      : null;
  const rewards = dedupeRewards([
    ...extractedChanges.rewards.filter((reward) => !canonicalBossPattern?.test(reward.label)),
    ...bossChanges.rewards,
  ]);
  const costs = dedupeRewards([
    ...extractedChanges.costs.filter((cost) => !canonicalBossPattern?.test(cost.label)),
    ...bossChanges.costs,
  ]);
  return {
    id: identifier(sceneKey),
    chapterId,
    code,
    title,
    trigger,
    location: locationContext.mapNames.length
      ? `${locationContext.mapNames.join(" → ")} · ${locationContext.areaName}`
      : locationContext.areaName,
    locationContext,
    characters: [...new Set([...declaredPeople, ...dialogueSpeakers].map(speakerIdOf))],
    description: sceneDescription(body, `${code} · ${title}`),
    rewards,
    costs,
    ...graph,
    source: { document: sourceDocument, heading, markdown: body.trim(), importedAt },
    updatedAt: importedAt,
  };
}

function createChapters(definitions, prefix) {
  return definitions.map(([code, title, detail, summary], index) => ({
    id: `${prefix}_${identifier(code)}`,
    code,
    title,
    summary: summary ? `任务 ${detail}；主题：${summary}` : `${detail} · ${title}`,
    order: index + 1,
  }));
}

function currentMainChapterCode(sourceCode) {
  if (sourceCode === "P0-01" || sourceCode === "P0-02") return "P0";
  const map = { M1: "C01", M2: "C02", M3: "C03", M4: "C04", E: "DEMO" };
  return map[sourceCode.split("-")[0]];
}

function parseCurrentMainScenes(markdown, projectId, chapterByCode, importedAt) {
  const start = markdown.indexOf("## 第一编：1.0主线 P0–C04");
  const end = markdown.indexOf("## 第二编：1.0四条支线");
  return headingSections(markdown).filter((section) => (
    section.index > start
    && section.index < end
    && section.level === 4
    && /^(?:场景 )?([A-Z][A-Z0-9]*-\d+[A-Z]?)：/.test(section.text)
  )).map((section) => {
    const [, sourceCode, title] = section.text.match(/^(?:场景 )?([A-Z][A-Z0-9]*-\d+[A-Z]?)：(.+)$/);
    const chapterCode = currentMainChapterCode(sourceCode);
    return makeScene({
      projectId,
      chapterId: chapterByCode.get(chapterCode).id,
      code: sourceCode,
      sourceCode,
      title,
      body: section.body,
      heading: section.heading,
      sourceDocument: sourceLabels.current,
      importedAt,
    });
  });
}

function detailedMainDescriptor(section) {
  let match = section.text.match(/^场景 ([A-Z]\d{2}-[A-Z]?\d+|[ABC]\d{2})：(.+)$/);
  if (match) {
    const sourceCode = match[1];
    const chapterCode = /^[ABC]\d{2}$/.test(sourceCode) ? "C13" : sourceCode.slice(0, 3);
    const code = chapterCode === "C13" ? `C13-${sourceCode}` : sourceCode;
    return { sourceCode, chapterCode, code, title: match[2], mode: "detailed" };
  }
  match = section.text.match(/^阶段([ABC]\d+)：(.+)$/);
  if (match) return { sourceCode: `C12-${match[1]}`, chapterCode: "C12", code: `C12-${match[1]}`, title: match[2], mode: "sequence" };
  match = section.text.match(/^特殊常规([一二])：(.+)$/);
  if (match) {
    const suffix = match[1] === "一" ? "S1" : "S2";
    return { sourceCode: `C12-A-${suffix}`, chapterCode: "C12", code: `C12-A-${suffix}`, title: match[2], mode: "outcomes" };
  }
  match = section.text.match(/^(C\d{2})章节结算$/);
  if (match) return { sourceCode: `${match[1]}-END`, chapterCode: match[1], code: `${match[1]}-END`, title: "章节结算", mode: "sequence" };
  return null;
}

function parseDetailedMainScenes(markdown, projectId, chapterByCode, importedAt) {
  return headingSections(markdown).filter((section) => section.level === 4).flatMap((section) => {
    const descriptor = detailedMainDescriptor(section);
    if (!descriptor) return [];
    return [makeScene({
      projectId,
      chapterId: chapterByCode.get(descriptor.chapterCode).id,
      code: descriptor.code,
      sourceCode: descriptor.sourceCode,
      title: descriptor.title,
      body: section.body,
      heading: section.heading,
      sourceDocument: sourceLabels.main,
      importedAt,
      mode: descriptor.mode,
    })];
  });
}

function parseCurrentSideScenes(markdown, projectId, chapterByCode, importedAt) {
  const start = markdown.indexOf("## 第二编：1.0四条支线");
  const end = markdown.indexOf("### 6. 支线状态与汇流矩阵", start);
  return headingSections(markdown).filter((section) => (
    section.index > start
    && section.index < end
    && section.level === 4
    && /^Q[1-4]-\d+[A-Z]?：/.test(section.text)
  )).map((section) => {
    const [, sourceCode, title] = section.text.match(/^(Q[1-4]-\d+[A-Z]?)：(.+)$/);
    const chapterCode = `W${sourceCode[1]}`;
    return makeScene({
      projectId,
      chapterId: chapterByCode.get(chapterCode).id,
      code: sourceCode,
      sourceCode,
      title,
      body: section.body,
      heading: section.heading,
      sourceDocument: sourceLabels.current,
      importedAt,
    });
  });
}

function sectionsWithin(markdown, parentSection, level) {
  return headingSections(markdown).filter((section) => (
    section.level === level
    && section.index > parentSection.index
    && section.index < parentSection.endIndex
  ));
}

function worldSideScenes(markdown, parent, worldIndex, projectId, chapter, importedAt) {
  return sectionsWithin(markdown, parent, 3).filter((section) => /^(?:阶段[A-D]|终局结果)/.test(section.text)).map((section) => {
    const stage = section.text.match(/^阶段([A-D])/)?.[1] ?? "END";
    const title = section.text.includes("：") ? section.text.slice(section.text.indexOf("：") + 1) : "终局结果";
    const code = `W${worldIndex}-${stage}`;
    return makeScene({
      projectId,
      chapterId: chapter.id,
      code,
      sourceCode: code,
      title,
      body: section.body,
      heading: section.heading,
      sourceDocument: sourceLabels.side,
      importedAt,
      mode: stage === "END" ? "outcomes" : "sequence",
    });
  });
}

function personalSideScenes(parent, personalIndex, projectId, chapter, importedAt) {
  const resultMarker = parent.body.indexOf("关键结果：");
  if (resultMarker < 0) throw new Error(`个人支线缺少关键结果：${parent.heading}`);
  const flowBody = parent.body.slice(0, resultMarker).trim();
  const resultBody = parent.body.slice(resultMarker + "关键结果：".length).trim();
  return [
    makeScene({
      projectId,
      chapterId: chapter.id,
      code: `P${personalIndex}-FLOW`,
      sourceCode: `P${personalIndex}-FLOW`,
      title: "跨章框架节点",
      body: flowBody,
      heading: parent.heading,
      sourceDocument: sourceLabels.side,
      importedAt,
      mode: "sequence",
    }),
    makeScene({
      projectId,
      chapterId: chapter.id,
      code: `P${personalIndex}-END`,
      sourceCode: `P${personalIndex}-END`,
      title: "关键结果",
      body: resultBody,
      heading: parent.heading,
      sourceDocument: sourceLabels.side,
      importedAt,
      mode: "outcomes",
    }),
  ];
}

const endingSectionCodes = {
  "任务出现条件（非终局资格）": ["S-ACTIVATE", "出现条件", "sequence"],
  "任务节点": ["S-NODES", "任务节点", "sequence"],
  "失败与降级": ["S-FAIL", "失败与降级", "sequence"],
  "完成结果": ["END", "完成结果", "sequence"],
  "第一契：借名（C09）": ["D-FIRST", "第一契·借名", "sequence"],
  "第二契：借身（C10）": ["D-SECOND", "第二契·借身", "sequence"],
  "锚点准备（C10–C12）": ["D-ANCHOR", "锚点准备", "sequence"],
  "第三契：借界（C12）": ["D-THIRD", "第三契·借界", "sequence"],
};

function endingSideScenes(markdown, parent, endingKind, projectId, chapter, importedAt) {
  return sectionsWithin(markdown, parent, 3).flatMap((section) => {
    const mapping = endingSectionCodes[section.text];
    if (!mapping) return [];
    let [code, title, mode] = mapping;
    if (code === "END") code = `${endingKind}-END`;
    return [makeScene({
      projectId,
      chapterId: chapter.id,
      code,
      sourceCode: code,
      title,
      body: section.body,
      heading: section.heading,
      sourceDocument: sourceLabels.side,
      importedAt,
      mode,
    })];
  });
}

function parseLongSideScenes(markdown, projectId, chapterByCode, importedAt) {
  const taskSections = headingSections(markdown).filter((section) => section.level === 2);
  const scenes = [];
  for (const parent of taskSections) {
    const numbered = parent.text.match(/^(\d+)\. /);
    const sectionNumber = Number(numbered?.[1]);
    if (sectionNumber >= 4 && sectionNumber <= 9) {
      const worldIndex = sectionNumber - 3;
      scenes.push(...worldSideScenes(markdown, parent, worldIndex, projectId, chapterByCode.get(`W${worldIndex}`), importedAt));
    } else if (sectionNumber >= 10 && sectionNumber <= 13) {
      const personalIndex = sectionNumber - 9;
      scenes.push(...personalSideScenes(parent, personalIndex, projectId, chapterByCode.get(`P${personalIndex}`), importedAt));
    } else if (sectionNumber === 14) {
      scenes.push(...endingSideScenes(markdown, parent, "S", projectId, chapterByCode.get("END-S"), importedAt));
    } else if (sectionNumber === 15) {
      scenes.push(...endingSideScenes(markdown, parent, "D", projectId, chapterByCode.get("END-D"), importedAt));
    }
  }
  return scenes;
}

function parseVariables(markdowns) {
  const variables = new Map();
  for (const markdown of markdowns) {
    for (const line of markdown.split("\n")) {
      if (!/^\|\s*`[a-z][a-z0-9_]+`\s*\|/.test(line)) continue;
      const cells = line.split("|").slice(1, -1).map((cell) => cleanMarkdown(cell));
      if (cells.length !== 3 && cells.length !== 4) continue;
      const id = cells[0];
      const range = cells[1];
      const description = cells.slice(2).join("；");
      const type = /bool/.test(range)
        ? "boolean"
        : /(?:-?\d+\s*(?:…|–|-)\s*-?\d+|^\d+(?:\s*\/\s*\d+)+$)/.test(range)
          ? "counter"
          : "enum";
      variables.set(id, {
        id,
        label: variableLabels[id] ?? id,
        type,
        ...(type !== "boolean" ? { range } : {}),
        description,
      });
    }
  }
  const corpus = markdowns.join("\n");
  for (const match of corpus.matchAll(/`([a-z][a-z0-9_]+)\s*(?:=|\+=|-=|≥|<=|>=|≤|>|<)/g)) {
    const id = match[1];
    if (variables.has(id)) continue;
    variables.set(id, {
      id,
      label: variableLabels[id] ?? id,
      type: "enum",
      description: "剧情正文中的候选状态；精确Schema仍待产品化。",
    });
  }
  return [...variables.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function buildProjects(sources, importedAt = new Date().toISOString()) {
  const mainProjectId = "main_kunwu_three_ages";
  const sideProjectId = "side_kunwu_complete_quests";
  const mainChapters = createChapters(mainChapterDefinitions, "main");
  const sideChapters = createChapters(sideChapterDefinitions, "side");
  const mainChapterByCode = new Map(mainChapters.map((chapter) => [chapter.code, chapter]));
  const sideChapterByCode = new Map(sideChapters.map((chapter) => [chapter.code, chapter]));

  const currentMainScenes = parseCurrentMainScenes(sources.current, mainProjectId, mainChapterByCode, importedAt);
  const detailedMainScenes = parseDetailedMainScenes(sources.main, mainProjectId, mainChapterByCode, importedAt);
  const currentSideScenes = parseCurrentSideScenes(sources.current, sideProjectId, sideChapterByCode, importedAt);
  const longSideScenes = parseLongSideScenes(sources.side, sideProjectId, sideChapterByCode, importedAt);
  const allVariables = parseVariables([sources.current, sources.outline, sources.main]);
  const sideCorpus = `${sources.current.slice(sources.current.indexOf("## 第二编：1.0四条支线"))}\n${sources.side}`;

  const mainProject = {
    schemaVersion: 2,
    id: mainProjectId,
    category: "main",
    title: "昆吾无名录",
    subtitle: "完整主线 · P0–C13 · 三次穿越与三种人界",
    synopsis: "外营掌印人带领石岩、陆清、白灵、墨言追查十二年前旧案，三次投影上古，并在重新封链、灵魔归元与举界入魔之间作出终局选择。",
    version: `${versionOf(sources.current)}+${versionOf(sources.main)}`,
    status: "draft",
    chapters: mainChapters,
    scenes: [...currentMainScenes, ...detailedMainScenes],
    variables: allVariables,
    sourceDocuments: [sourceLabels.current, sourceLabels.outline, sourceLabels.main, sourceLabels.reward, sourceLabels.mapFramework],
    updatedAt: importedAt,
    updatedBy: "新剧情事实源导入器",
  };

  const sideProject = {
    schemaVersion: 2,
    id: sideProjectId,
    category: "side",
    title: "昆吾因果支线库",
    subtitle: "6条世界线 · 4条个人线 · 2条结局专属任务",
    synopsis: "从1.0四条详细支线延伸到完整游戏的十二条任务链，产出证词、盟约、阵位、阵器、裂界锚点与人物尾声。",
    version: `${versionOf(sources.current)}+${versionOf(sources.side)}`,
    status: "draft",
    chapters: sideChapters,
    scenes: [...currentSideScenes, ...longSideScenes],
    variables: allVariables.filter((variable) => sideCorpus.includes(variable.id)),
    sourceDocuments: [sourceLabels.current, sourceLabels.outline, sourceLabels.side, sourceLabels.mapFramework],
    updatedAt: importedAt,
    updatedBy: "新剧情事实源导入器",
  };

  return { mainProject, sideProject };
}

async function writeProject(project) {
  const directory = path.join(adminRoot, "data", "stories");
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, `${project.id}.json`);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(project, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

export async function importStoryDrafts() {
  const entries = await Promise.all(Object.entries(sourcePaths).map(async ([key, sourcePath]) => [key, await readFile(sourcePath, "utf8")]));
  const sources = Object.fromEntries(entries);
  const result = buildProjects(sources);
  await Promise.all([writeProject(result.mainProject), writeProject(result.sideProject)]);
  return result;
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  const { mainProject, sideProject } = await importStoryDrafts();
  const summarize = (project) => ({
    id: project.id,
    chapters: project.chapters.length,
    scenes: project.scenes.length,
    nodes: project.scenes.reduce((sum, scene) => sum + scene.nodes.length, 0),
    dialogueLines: project.scenes.reduce((sum, scene) => sum + scene.nodes.reduce((nodeSum, node) => nodeSum + (node.data.lines?.length ?? 0), 0), 0),
    decisions: project.scenes.reduce((sum, scene) => sum + scene.nodes.filter((node) => node.type === "choice" || node.type === "check").length, 0),
    sourceDocuments: project.sourceDocuments,
  });
  console.log(JSON.stringify({ main: summarize(mainProject), side: summarize(sideProject) }, null, 2));
}
