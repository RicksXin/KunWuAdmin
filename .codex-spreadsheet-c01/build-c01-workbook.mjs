import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = "/Users/zhangxiaoen/Desktop/Game/KunWuAdmin";
const sourceJson = path.join(projectRoot, "data/stories/main_kunwu_three_ages.json");
const outputDir = path.join(projectRoot, "outputs/c01_story_20260806");
const previewDir = path.join(projectRoot, ".codex-spreadsheet-c01/previews");
const outputPath = path.join(outputDir, "KunWu_C01_剧情整理.xlsx");

const project = JSON.parse(await fs.readFile(sourceJson, "utf8"));
const chapter = project.chapters.find((item) => item.code === "C01");
const scenes = project.scenes.filter((scene) => scene.chapterId === chapter.id);

if (!chapter || scenes.length === 0) throw new Error("C01_DATA_NOT_FOUND");

const typeLabels = {
  entry: "入口",
  dialogue: "对话",
  choice: "选项",
  check: "检定",
  action: "结算",
  combat: "战斗",
  ending: "结束",
};
const choiceLabels = { attitude: "态度", method: "方法", irreversible: "不可逆" };
const branchLabels = {
  merge: "执行专属结果后汇流",
  "continue-branch": "继续专属分支",
  terminal: "在此结束",
  unknown: "尚未冻结",
};
const certaintyLabels = { explicit: "原文明示", inferred: "地图推断", "cross-map": "跨地图" };
const rewardKindLabels = { item: "道具", currency: "资源", recipe: "配方", equipment: "装备", feature: "功能/状态", narrative: "叙事结果" };
const rewardTimingLabels = { immediate: "立即", delayed: "延迟领取", conditional: "满足条件时" };

function joinText(values) {
  return values.filter(Boolean).join("\n");
}

function nodeContent(node) {
  if (node.type === "dialogue") return node.data.lines?.[0] ? `${node.data.lines[0].speakerName}：${node.data.lines[0].text}` : "";
  if (node.type === "choice" || node.type === "check") return node.data.optionText || node.data.title;
  return node.data.description || "";
}

const nodeRows = [];
const dialogueRows = [];
const choiceRows = [];
const rewardRows = [];

for (const scene of scenes) {
  const nodeById = new Map(scene.nodes.map((node) => [node.id, node]));
  scene.nodes.forEach((node, nodeIndex) => {
    const predecessors = scene.edges.filter((edge) => edge.target === node.id).map((edge) => nodeById.get(edge.source)?.data.title || edge.source);
    const successors = scene.edges.filter((edge) => edge.source === node.id).map((edge) => nodeById.get(edge.target)?.data.title || edge.target);
    nodeRows.push([
      scene.code,
      nodeIndex + 1,
      node.id,
      typeLabels[node.type] || node.type,
      node.data.title,
      nodeContent(node),
      joinText(predecessors),
      joinText(successors),
      branchLabels[node.data.branchBehavior] || "",
      joinText(node.data.effects || []),
      node.data.rewards?.length || 0,
      node.data.costs?.length || 0,
      scene.source?.heading || "",
    ]);

    (node.data.lines || []).forEach((line, lineIndex) => dialogueRows.push([
      scene.code,
      scene.title,
      "主对话",
      node.data.title,
      lineIndex + 1,
      line.speakerName,
      line.text,
      line.emotion || "默认",
      null,
      null,
      scene.source?.heading || "",
    ]));

    (node.data.followUpLines || []).forEach((line, lineIndex) => dialogueRows.push([
      scene.code,
      scene.title,
      "选项专属对白",
      node.data.title,
      lineIndex + 1,
      line.speakerName,
      line.text,
      line.emotion || "默认",
      null,
      null,
      scene.source?.heading || "",
    ]));

    if (node.type === "choice" || node.type === "check") {
      const match = node.id.match(/_choice_(\d+)_(\d+)$/);
      choiceRows.push([
        scene.code,
        scene.title,
        match ? Number(match[1]) : "",
        match ? Number(match[2]) : "",
        node.data.optionText || node.data.title,
        choiceLabels[node.data.choiceCategory] || "方法",
        node.data.requiresConfirmation ? "是" : "否",
        node.data.condition || "无",
        node.data.outcomeText || "原文未单独写明即时结果",
        joinText((node.data.followUpLines || []).map((line) => `${line.speakerName}：${line.text}`)) || node.data.followUpNote || "无逐字专属对白",
        node.data.followUpLines?.length || 0,
        branchLabels[node.data.branchBehavior] || "尚未冻结",
        joinText(node.data.effects || []),
        node.data.rewards?.length || 0,
        node.data.costs?.length || 0,
        scene.source?.heading || "",
      ]);
    }

    for (const [changeType, items] of [["奖励", node.data.rewards || []], ["消耗", node.data.costs || []]]) {
      for (const item of items) rewardRows.push([
        scene.code,
        scene.title,
        "具体节点",
        node.data.title,
        changeType,
        rewardKindLabels[item.kind] || item.kind,
        item.label,
        item.quantity ?? "",
        rewardTimingLabels[item.timing] || item.timing,
        item.sourceText,
        scene.source?.heading || "",
      ]);
    }
  });

  for (const [changeType, items] of [["奖励", scene.rewards || []], ["消耗", scene.costs || []]]) {
    for (const item of items) rewardRows.push([
      scene.code,
      scene.title,
      "场景汇总",
      "—",
      changeType,
      rewardKindLabels[item.kind] || item.kind,
      item.label,
      item.quantity ?? "",
      rewardTimingLabels[item.timing] || item.timing,
      item.sourceText,
      scene.source?.heading || "",
    ]);
  }
}

const workbook = Workbook.create();
const overview = workbook.worksheets.add("章节总览");
const nodesSheet = workbook.worksheets.add("场景节点");
const dialogueSheet = workbook.worksheets.add("对白");
const choicesSheet = workbook.worksheets.add("选项与结果");
const rewardsSheet = workbook.worksheets.add("奖励与消耗");
const sourceSheet = workbook.worksheets.add("原文场景");

const palette = {
  dark: "#17352B",
  dark2: "#285646",
  gold: "#C49553",
  goldLight: "#F5E8D3",
  sage: "#E8F0EB",
  paper: "#F7F8F4",
  line: "#CAD6CF",
  text: "#20332B",
  muted: "#66776F",
  red: "#A95449",
  redLight: "#F8E7E4",
  blueLight: "#E7EFF7",
};

function styleTitle(sheet, endColumn, title, subtitle) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${endColumn}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A1:${endColumn}1`).format = {
    fill: palette.dark,
    font: { bold: true, color: "#FFFFFF", size: 18 },
    verticalAlignment: "center",
  };
  sheet.getRange(`A1:${endColumn}1`).format.rowHeight = 34;
  sheet.getRange(`A2:${endColumn}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange(`A2:${endColumn}2`).format = {
    fill: palette.dark2,
    font: { color: "#DDE9E2", size: 10 },
    verticalAlignment: "center",
  };
  sheet.getRange(`A2:${endColumn}2`).format.rowHeight = 23;
}

function styleHeader(range) {
  range.format = {
    fill: palette.dark2,
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: palette.dark },
  };
  range.format.rowHeight = 30;
}

function styleBody(range, rowHeight = 42) {
  range.format = {
    fill: palette.paper,
    font: { color: palette.text, size: 9 },
    verticalAlignment: "top",
    wrapText: true,
    borders: { insideHorizontal: { style: "thin", color: palette.line } },
  };
  range.format.rowHeight = rowHeight;
}

function addTable(sheet, rangeAddress, name) {
  const table = sheet.tables.add(rangeAddress, true, name);
  table.style = "TableStyleMedium4";
  table.showFilterButton = true;
  table.showBandedRows = true;
  return table;
}

// 章节总览
styleTitle(overview, "L", "昆吾剧情 C01｜山门灯灭", `数据版本：${project.version}　·　生成范围：M1-01 至 M1-05　·　位置口径：1.0剧情事实源 + 地图27`);
overview.getRange("A4:H5").values = [
  ["场景数", null, "节点数", null, "对白记录", null, "选项/检定", null],
  [null, null, null, null, null, null, null, null],
];
overview.getRange("A4:H4").format = { fill: palette.sage, font: { bold: true, color: palette.muted }, horizontalAlignment: "center" };
overview.getRange("A5:H5").format = { fill: "#FFFFFF", font: { bold: true, color: palette.dark, size: 16 }, horizontalAlignment: "center", borders: { preset: "outside", style: "thin", color: palette.line } };
overview.getRange("A5:B5").merge(); overview.getRange("A5").formulas = [[`=COUNTA(A9:A${8 + scenes.length})`]];
overview.getRange("C5:D5").merge(); overview.getRange("C5").formulas = [[`=COUNTA('场景节点'!A5:A${4 + nodeRows.length})`]];
overview.getRange("E5:F5").merge(); overview.getRange("E5").formulas = [[`=COUNTA('对白'!A5:A${4 + dialogueRows.length})`]];
overview.getRange("G5:H5").merge(); overview.getRange("G5").formulas = [[`=COUNTA('选项与结果'!A5:A${4 + choiceRows.length})`]];
overview.getRange("J4:L4").merge(); overview.getRange("J4").values = [["场景级明确奖励"]];
overview.getRange("J4:L4").format = { fill: palette.goldLight, font: { bold: true, color: "#76562F" }, horizontalAlignment: "center" };
overview.getRange("J5:L5").merge(); overview.getRange("J5").formulas = [[`=COUNTIFS('奖励与消耗'!$C$5:$C$${4 + rewardRows.length},"场景汇总",'奖励与消耗'!$E$5:$E$${4 + rewardRows.length},"奖励")`]];
overview.getRange("J5:L5").format = { fill: "#FFFFFF", font: { bold: true, color: "#76562F", size: 16 }, horizontalAlignment: "center", borders: { preset: "outside", style: "thin", color: "#D7BE96" } };

const overviewHeaders = ["场景代码", "场景名称", "地图ID", "地图名称", "区域/坐标", "位置依据", "时态/玩法", "触发条件", "节点数", "对白数", "选项数", "奖励项"];
overview.getRange("A8:L8").values = [overviewHeaders];
const overviewRows = scenes.map((scene) => [
  scene.code,
  scene.title,
  scene.locationContext.mapIds.join(" → ") || "—",
  scene.locationContext.mapNames.join(" → ") || "未冻结",
  scene.locationContext.areaName,
  certaintyLabels[scene.locationContext.certainty] || scene.locationContext.certainty,
  `${scene.locationContext.timeline} / ${scene.locationContext.explorationMode === "expedition" ? "当世肉身远征" : scene.locationContext.explorationMode}`,
  scene.trigger,
  null,
  null,
  null,
  null,
]);
overview.getRange(`A9:L${8 + overviewRows.length}`).values = overviewRows;
for (let row = 9; row <= 8 + overviewRows.length; row += 1) {
  overview.getRange(`I${row}`).formulas = [[`=COUNTIF('场景节点'!$A$5:$A$${4 + nodeRows.length},A${row})`]];
  overview.getRange(`J${row}`).formulas = [[`=COUNTIF('对白'!$A$5:$A$${4 + dialogueRows.length},A${row})`]];
  overview.getRange(`K${row}`).formulas = [[`=COUNTIF('选项与结果'!$A$5:$A$${4 + choiceRows.length},A${row})`]];
  overview.getRange(`L${row}`).formulas = [[`=COUNTIFS('奖励与消耗'!$A$5:$A$${4 + rewardRows.length},A${row},'奖励与消耗'!$C$5:$C$${4 + rewardRows.length},"场景汇总",'奖励与消耗'!$E$5:$E$${4 + rewardRows.length},"奖励")`]];
}
styleHeader(overview.getRange("A8:L8"));
styleBody(overview.getRange(`A9:L${8 + overviewRows.length}`), 58);
addTable(overview, `A8:L${8 + overviewRows.length}`, "C01SceneSummary");
overview.freezePanes.freezeRows(8);
overview.freezePanes.freezeColumns(2);
overview.getRange("A16:L16").merge(); overview.getRange("A16").values = [["阅读说明"]];
overview.getRange("A16:L16").format = { fill: palette.goldLight, font: { bold: true, color: "#76562F" } };
overview.getRange("A17:L19").merge();
overview.getRange("A17").values = [[`C01 的 5 个场景均发生于 map_01「破禁山麓·万修之门」。标记为“地图推断”的位置，是原文明确了区域/坐标，但地图 ID 由地图27的 C01 章节网络补足。\n数据来源：${scenes[0].source.document}\n原始配置：${sourceJson}`]];
overview.getRange("A17:L19").format = { fill: "#FFFFFF", font: { color: palette.muted, size: 9 }, wrapText: true, verticalAlignment: "top", borders: { preset: "outside", style: "thin", color: palette.line } };

// 场景节点
styleTitle(nodesSheet, "M", "C01 场景节点", "按图节点顺序列出入口、对话、选项、检定、结算、战斗和结束；前后节点用于理解汇流关系");
const nodeHeaders = ["场景", "顺序", "节点ID", "节点类型", "节点标题", "展示内容", "前置节点", "后续节点", "分支说明", "状态变化", "奖励数", "消耗数", "来源标题"];
nodesSheet.getRange("A4:M4").values = [nodeHeaders];
nodesSheet.getRange(`A5:M${4 + nodeRows.length}`).values = nodeRows;
styleHeader(nodesSheet.getRange("A4:M4"));
styleBody(nodesSheet.getRange(`A5:M${4 + nodeRows.length}`), 54);
addTable(nodesSheet, `A4:M${4 + nodeRows.length}`, "C01Nodes");
nodesSheet.freezePanes.freezeRows(4); nodesSheet.freezePanes.freezeColumns(2);

// 对白
styleTitle(dialogueSheet, "K", "C01 对白", "包括正文代码块台词与选项结果中明确写出的专属对白；字数和超限状态由公式计算");
const dialogueHeaders = ["场景", "场景名", "对白类型", "节点", "句序", "说话人", "台词", "表情", "字数", "超过36字", "来源标题"];
dialogueSheet.getRange("A4:K4").values = [dialogueHeaders];
dialogueSheet.getRange(`A5:K${4 + dialogueRows.length}`).values = dialogueRows;
dialogueSheet.getRange("I5").formulas = [["=LEN(SUBSTITUTE(G5,\" \",\"\"))"]];
dialogueSheet.getRange(`I5:I${4 + dialogueRows.length}`).fillDown();
dialogueSheet.getRange("J5").formulas = [["=IF(I5>36,\"是\",\"否\")"]];
dialogueSheet.getRange(`J5:J${4 + dialogueRows.length}`).fillDown();
styleHeader(dialogueSheet.getRange("A4:K4"));
styleBody(dialogueSheet.getRange(`A5:K${4 + dialogueRows.length}`), 40);
addTable(dialogueSheet, `A4:K${4 + dialogueRows.length}`, "C01Dialogue");
dialogueSheet.freezePanes.freezeRows(4); dialogueSheet.freezePanes.freezeColumns(2);
dialogueSheet.getRange(`J5:J${4 + dialogueRows.length}`).conditionalFormats.add("containsText", { text: "是", format: { fill: palette.redLight, font: { bold: true, color: palette.red } } });

// 选项与结果
styleTitle(choicesSheet, "P", "C01 选项与结果", "直接回答：玩家点了什么、会发生什么、有没有专属对白、之后是否汇流、是否有奖励或消耗");
const choiceHeaders = ["场景", "场景名", "选项组", "组内序号", "选项文案", "类型", "二次确认", "检定条件", "点击后结果", "专属后续对白/说明", "专属对白句数", "后续走向", "状态变化", "奖励数", "消耗数", "来源标题"];
choicesSheet.getRange("A4:P4").values = [choiceHeaders];
choicesSheet.getRange(`A5:P${4 + choiceRows.length}`).values = choiceRows;
styleHeader(choicesSheet.getRange("A4:P4"));
styleBody(choicesSheet.getRange(`A5:P${4 + choiceRows.length}`), 76);
addTable(choicesSheet, `A4:P${4 + choiceRows.length}`, "C01Choices");
choicesSheet.freezePanes.freezeRows(4); choicesSheet.freezePanes.freezeColumns(2);
const categoryRange = choicesSheet.getRange(`F5:F${4 + choiceRows.length}`);
categoryRange.conditionalFormats.add("containsText", { text: "不可逆", format: { fill: palette.redLight, font: { bold: true, color: palette.red } } });
categoryRange.conditionalFormats.add("containsText", { text: "态度", format: { fill: palette.blueLight, font: { color: "#3D6280" } } });
categoryRange.conditionalFormats.add("containsText", { text: "方法", format: { fill: palette.sage, font: { color: palette.dark2 } } });

// 奖励与消耗
styleTitle(rewardsSheet, "K", "C01 奖励与消耗", "“场景汇总”用于快速查看整场奖励；“具体节点”用于定位奖励属于哪个选项或结算节点");
const rewardHeaders = ["场景", "场景名", "归属层级", "节点", "变更类型", "类别", "名称", "数量", "发放时机", "原文依据", "来源标题"];
rewardsSheet.getRange("A4:K4").values = [rewardHeaders];
rewardsSheet.getRange(`A5:K${4 + rewardRows.length}`).values = rewardRows;
styleHeader(rewardsSheet.getRange("A4:K4"));
styleBody(rewardsSheet.getRange(`A5:K${4 + rewardRows.length}`), 56);
addTable(rewardsSheet, `A4:K${4 + rewardRows.length}`, "C01Rewards");
rewardsSheet.freezePanes.freezeRows(4); rewardsSheet.freezePanes.freezeColumns(2);
rewardsSheet.getRange(`E5:E${4 + rewardRows.length}`).conditionalFormats.add("containsText", { text: "奖励", format: { fill: palette.sage, font: { bold: true, color: palette.dark2 } } });
rewardsSheet.getRange(`E5:E${4 + rewardRows.length}`).conditionalFormats.add("containsText", { text: "消耗", format: { fill: palette.redLight, font: { bold: true, color: palette.red } } });
rewardsSheet.getRange(`H5:H${4 + rewardRows.length}`).format.numberFormat = "#,##0";

// 原文快照
styleTitle(sourceSheet, "C", "C01 原文场景", "每个场景保留同步时的完整 Markdown 快照，供策划逐字核对；整理表不替代事实源");
sourceSheet.getRange("A4:C4").values = [["场景", "来源标题", "完整原文快照"]];
const sourceRows = scenes.map((scene) => [scene.code, scene.source.heading, scene.source.markdown]);
sourceSheet.getRange(`A5:C${4 + sourceRows.length}`).values = sourceRows;
styleHeader(sourceSheet.getRange("A4:C4"));
styleBody(sourceSheet.getRange(`A5:C${4 + sourceRows.length}`), 210);
addTable(sourceSheet, `A4:C${4 + sourceRows.length}`, "C01SourceSnapshots");
sourceSheet.freezePanes.freezeRows(4); sourceSheet.freezePanes.freezeColumns(2);

// 列宽
const widths = [
  [overview, { A: 80, B: 130, C: 95, D: 165, E: 150, F: 88, G: 135, H: 280, I: 65, J: 65, K: 65, L: 68 }],
  [nodesSheet, { A: 72, B: 48, C: 240, D: 68, E: 150, F: 250, G: 150, H: 150, I: 150, J: 210, K: 62, L: 62, M: 180 }],
  [dialogueSheet, { A: 72, B: 120, C: 92, D: 145, E: 52, F: 88, G: 330, H: 75, I: 55, J: 75, K: 190 }],
  [choicesSheet, { A: 72, B: 120, C: 58, D: 65, E: 220, F: 68, G: 75, H: 120, I: 320, J: 260, K: 78, L: 150, M: 210, N: 62, O: 62, P: 190 }],
  [rewardsSheet, { A: 72, B: 120, C: 90, D: 150, E: 78, F: 80, G: 210, H: 60, I: 95, J: 360, K: 190 }],
  [sourceSheet, { A: 80, B: 220, C: 760 }],
];
for (const [sheet, mapping] of widths) {
  for (const [column, widthPx] of Object.entries(mapping)) sheet.getRange(`${column}:${column}`).format.columnWidthPx = widthPx;
}

dialogueSheet.getRange(`E5:E${4 + dialogueRows.length}`).format.numberFormat = "0";
dialogueSheet.getRange(`I5:I${4 + dialogueRows.length}`).format.numberFormat = "0";
choicesSheet.getRange(`C5:D${4 + choiceRows.length}`).format.numberFormat = "0";
choicesSheet.getRange(`K5:O${4 + choiceRows.length}`).format.numberFormat = "0";
overview.getRange(`I9:L${8 + overviewRows.length}`).format.numberFormat = "0";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const renderTargets = [
  ["章节总览", "A1:L19", "01-overview.png"],
  ["场景节点", `A1:M${Math.min(18, 4 + nodeRows.length)}`, "02-nodes.png"],
  ["对白", `A1:K${Math.min(18, 4 + dialogueRows.length)}`, "03-dialogue.png"],
  ["选项与结果", `A1:P${Math.min(15, 4 + choiceRows.length)}`, "04-choices.png"],
  ["奖励与消耗", `A1:K${Math.min(18, 4 + rewardRows.length)}`, "05-rewards.png"],
  ["原文场景", `A1:C${4 + sourceRows.length}`, "06-source.png"],
];

for (const [sheetName, range, fileName] of renderTargets) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(path.join(previewDir, fileName), new Uint8Array(await preview.arrayBuffer()));
}

const overviewCheck = await workbook.inspect({
  kind: "table",
  range: `章节总览!A4:L${8 + overviewRows.length}`,
  include: "values,formulas",
  tableMaxRows: 14,
  tableMaxCols: 12,
  maxChars: 8000,
});
const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(JSON.stringify({
  outputPath,
  stats: {
    scenes: scenes.length,
    nodes: nodeRows.length,
    dialogueRecords: dialogueRows.length,
    choices: choiceRows.length,
    rewardAndCostRows: rewardRows.length,
    sourceSnapshots: sourceRows.length,
  },
  overviewInspect: overviewCheck.ndjson,
  formulaErrors: formulaErrors.ndjson,
}, null, 2));
