import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { adminRoot, sourceLabels, sourcePaths } from "./import-story-drafts.mjs";

const sourceEntries = await Promise.all(Object.entries(sourcePaths).map(async ([key, sourcePath]) => [key, await readFile(sourcePath, "utf8")]));
const sources = Object.fromEntries(sourceEntries);
const storyDirectory = path.join(adminRoot, "data", "stories");
const [mainJson, sideJson, storyFiles] = await Promise.all([
  readFile(path.join(storyDirectory, "main_kunwu_three_ages.json"), "utf8"),
  readFile(path.join(storyDirectory, "side_kunwu_complete_quests.json"), "utf8"),
  readdir(storyDirectory),
]);
const mainProject = JSON.parse(mainJson);
const sideProject = JSON.parse(sideJson);
const failures = [];

function headingSections(markdown) {
  const headings = [...markdown.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
    level: match[1].length,
    text: match[2].trim(),
    heading: match[0],
    index: match.index,
  }));
  return headings.map((heading, index) => {
    const next = headings.slice(index + 1).find((item) => item.level <= heading.level);
    return { ...heading, endIndex: next?.index ?? markdown.length };
  });
}

function currentMainCodes() {
  const start = sources.current.indexOf("## 第一编：1.0主线 P0–C04");
  const end = sources.current.indexOf("## 第二编：1.0四条支线");
  return headingSections(sources.current).flatMap((section) => {
    if (section.level !== 4 || section.index <= start || section.index >= end) return [];
    return section.text.match(/^(?:场景 )?([A-Z][A-Z0-9]*-\d+[A-Z]?)：/)?.slice(1) ?? [];
  });
}

function detailedMainCodes() {
  return headingSections(sources.main).flatMap((section) => {
    if (section.level !== 4) return [];
    let match = section.text.match(/^场景 ([A-Z]\d{2}-[A-Z]?\d+|[ABC]\d{2})：/);
    if (match) return [/^[ABC]\d{2}$/.test(match[1]) ? `C13-${match[1]}` : match[1]];
    match = section.text.match(/^阶段([ABC]\d+)：/);
    if (match) return [`C12-${match[1]}`];
    match = section.text.match(/^特殊常规([一二])：/);
    if (match) return [`C12-A-${match[1] === "一" ? "S1" : "S2"}`];
    match = section.text.match(/^(C\d{2})章节结算$/);
    return match ? [`${match[1]}-END`] : [];
  });
}

function currentSideCodes() {
  const start = sources.current.indexOf("## 第二编：1.0四条支线");
  const end = sources.current.indexOf("### 6. 支线状态与汇流矩阵", start);
  return headingSections(sources.current).flatMap((section) => {
    if (section.level !== 4 || section.index <= start || section.index >= end) return [];
    return section.text.match(/^(Q[1-4]-\d+[A-Z]?)：/)?.slice(1) ?? [];
  });
}

const endingCodes = {
  "任务出现条件（非终局资格）": "S-ACTIVATE",
  "任务节点": "S-NODES",
  "失败与降级": "S-FAIL",
  "第一契：借名（C09）": "D-FIRST",
  "第二契：借身（C10）": "D-SECOND",
  "锚点准备（C10–C12）": "D-ANCHOR",
  "第三契：借界（C12）": "D-THIRD",
};

function longSideCodes() {
  const headings = headingSections(sources.side);
  const codes = [];
  for (const parent of headings.filter((section) => section.level === 2)) {
    const sectionNumber = Number(parent.text.match(/^(\d+)\. /)?.[1]);
    const children = headings.filter((section) => section.level === 3 && section.index > parent.index && section.index < parent.endIndex);
    if (sectionNumber >= 4 && sectionNumber <= 9) {
      const worldIndex = sectionNumber - 3;
      for (const child of children) {
        const stage = child.text.match(/^阶段([A-D])/)?.[1];
        if (stage) codes.push(`W${worldIndex}-${stage}`);
        else if (child.text === "终局结果") codes.push(`W${worldIndex}-END`);
      }
    } else if (sectionNumber >= 10 && sectionNumber <= 13) {
      const personalIndex = sectionNumber - 9;
      if (!sources.side.slice(parent.index, parent.endIndex).includes("关键结果：")) {
        failures.push(`支线源文档/${parent.text}: 缺少关键结果段`);
      }
      codes.push(`P${personalIndex}-FLOW`, `P${personalIndex}-END`);
    } else if (sectionNumber === 14 || sectionNumber === 15) {
      const prefix = sectionNumber === 14 ? "S" : "D";
      for (const child of children) {
        if (endingCodes[child.text]) codes.push(endingCodes[child.text]);
        else if (child.text === "完成结果") codes.push(`${prefix}-END`);
      }
    }
  }
  return codes;
}

function dialogueLineCount(markdown) {
  let count = 0;
  for (const block of markdown.matchAll(/```text\s*\n([\s\S]*?)\n```/g)) {
    count += block[1].split("\n").filter((line) => line.trim()).length;
  }
  return count;
}

function actualDialogueLineCount(scene) {
  return scene.nodes.reduce((sum, node) => sum + (node.data.lines?.length ?? 0), 0);
}

function detailedChoiceCount(markdown) {
  const lines = markdown.split("\n");
  let count = 0;
  let previousContent = "";
  let inFence = false;
  let counting = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      counting = false;
      continue;
    }
    if (inFence) continue;
    const item = line.match(/^\s*(?:\d+\.|-)\s+\S/);
    if (item) {
      if (!counting) {
        counting = /(?:选项|不可逆选择|玩家(?:可|可以)?回答|玩家(?:需要|可以|可)?选择|玩家回应|处理方式|旁路署名|可行方案|最终答案|再次决定|阵外批注内容由玩家选择|三种处理|四种处理)/.test(previousContent);
      }
      if (counting) count += 1;
      continue;
    }
    if (!/^\s{2,}\S/.test(line)) counting = false;
    if (line.trim()) previousContent = line.replace(/`|\*\*/g, "").trim();
  }
  for (const match of markdown.matchAll(/^(?:选项|选择|处理方式)：([^\n]+)$/gm)) {
    const items = match[1].split(/[；;]/).filter((item) => item.trim());
    if (items.length >= 2) count += items.length;
  }
  return count;
}

function expectedChoiceCount(scene) {
  if (/^(?:W[1-6]|P[1-4])-END$/.test(scene.code) || /^C12-A-S[12]$/.test(scene.code)) {
    return scene.source.markdown.split("\n").filter((line) => /^\s*(?:\d+\.|-)\s+\S/.test(line)).length;
  }
  return detailedChoiceCount(scene.source.markdown);
}

function auditProject(label, project, expectedCodes, expectedDocuments, expectedChapterCount) {
  const actualCodes = project.scenes.map((scene) => scene.code);
  if (expectedCodes.join("|") !== actualCodes.join("|")) {
    const missing = expectedCodes.filter((code) => !actualCodes.includes(code));
    const extra = actualCodes.filter((code) => !expectedCodes.includes(code));
    failures.push(`${label}: 场景清单或顺序与新事实源不一致（缺少 ${missing.join(",") || "无"}；多出 ${extra.join(",") || "无"}）`);
  }
  if (new Set(actualCodes).size !== actualCodes.length) failures.push(`${label}: 存在重复场景 code`);
  if (project.chapters.length !== expectedChapterCount) failures.push(`${label}: 章节数 ${project.chapters.length}/${expectedChapterCount}`);
  if (project.schemaVersion !== 2) failures.push(`${label}: schemaVersion 应为 2`);
  if (project.sourceDocuments.join("|") !== expectedDocuments.join("|")) failures.push(`${label}: 项目事实源清单不正确`);
  if (project.sourceDocuments.some((document) => !document.includes("Docs/1.0策划案/"))) failures.push(`${label}: 仍引用旧版策划文档`);

  const chapterIds = new Set(project.chapters.map((chapter) => chapter.id));
  const sceneIds = new Set();
  for (const scene of project.scenes) {
    if (sceneIds.has(scene.id)) failures.push(`${label}/${scene.code}: 重复场景 id`);
    sceneIds.add(scene.id);
    if (!chapterIds.has(scene.chapterId)) failures.push(`${label}/${scene.code}: chapterId 无效`);
    if (!scene.locationContext) failures.push(`${label}/${scene.code}: 缺少结构化地点`);
    else {
      if (!scene.locationContext.areaName || !scene.locationContext.timeline || !scene.locationContext.sourceText) failures.push(`${label}/${scene.code}: 结构化地点信息不完整`);
      if (["field-map", "memory", "cross-map"].includes(scene.locationContext.kind)
        && scene.locationContext.mapIds.length !== scene.locationContext.mapNames.length) failures.push(`${label}/${scene.code}: 地图ID与名称数量不一致`);
    }
    const sourceMarkdown = Object.entries(sourceLabels).find(([, value]) => value === scene.source?.document)?.[0];
    if (!sourceMarkdown) failures.push(`${label}/${scene.code}: 来源文档不在新事实源清单`);
    else {
      const original = sources[sourceMarkdown];
      if (!scene.source.markdown || !original.includes(scene.source.markdown)) failures.push(`${label}/${scene.code}: 原文快照缺失或不属于来源文档`);
      if (!original.includes(scene.source.heading)) failures.push(`${label}/${scene.code}: 来源标题不存在`);
    }

    const expectedDialogue = dialogueLineCount(scene.source.markdown);
    const actualDialogue = actualDialogueLineCount(scene);
    if (expectedDialogue !== actualDialogue) failures.push(`${label}/${scene.code}: 台词 ${actualDialogue}/${expectedDialogue}`);
    const expectedChoices = expectedChoiceCount(scene);
    const actualChoices = scene.nodes.filter((node) => node.type === "choice" || node.type === "check").length;
    if (expectedChoices !== actualChoices) failures.push(`${label}/${scene.code}: 显式选择/结果 ${actualChoices}/${expectedChoices}`);

    const nodeIds = new Set(scene.nodes.map((node) => node.id));
    if (nodeIds.size !== scene.nodes.length) failures.push(`${label}/${scene.code}: 节点 id 重复`);
    if (!nodeIds.has(scene.entryNodeId)) failures.push(`${label}/${scene.code}: 入口节点无效`);
    for (const edge of scene.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) failures.push(`${label}/${scene.code}: 存在断裂连线`);
    }
    for (const node of scene.nodes) {
      if (node.type === "choice" || node.type === "check") {
        if (!node.data.outcomeText) failures.push(`${label}/${scene.code}/${node.id}: 选择缺少结果说明`);
        if (!node.data.followUpNote) failures.push(`${label}/${scene.code}/${node.id}: 选择缺少后续对白说明`);
        if (!node.data.branchBehavior) failures.push(`${label}/${scene.code}/${node.id}: 选择缺少汇流说明`);
      }
      const rewardIds = [...(node.data.rewards ?? []), ...(node.data.costs ?? [])].map((reward) => reward.id);
      if (new Set(rewardIds).size !== rewardIds.length) failures.push(`${label}/${scene.code}/${node.id}: 奖励或消耗ID重复`);
    }
    const sceneRewardIds = [...(scene.rewards ?? []), ...(scene.costs ?? [])].map((reward) => reward.id);
    if (new Set(sceneRewardIds).size !== sceneRewardIds.length) failures.push(`${label}/${scene.code}: 场景奖励或消耗ID重复`);
  }
}

const expectedMainCodes = [...currentMainCodes(), ...detailedMainCodes()];
const expectedSideCodes = [...currentSideCodes(), ...longSideCodes()];
auditProject("完整主线", mainProject, expectedMainCodes, [sourceLabels.current, sourceLabels.outline, sourceLabels.main, sourceLabels.reward, sourceLabels.mapFramework], 15);
auditProject("完整支线", sideProject, expectedSideCodes, [sourceLabels.current, sourceLabels.outline, sourceLabels.side, sourceLabels.mapFramework], 12);

for (const [code, expectedLabels] of Object.entries({
  "M2-06": ["封坛尸将魂魄", "封坛军魂甲（上品）"],
  "M4-09": ["银翅尸煞魂魄", "银翅魂衣（珍品）"],
})) {
  const scene = mainProject.scenes.find((item) => item.code === code);
  for (const rewardLabel of expectedLabels) {
    if (!scene?.rewards?.some((reward) => reward.label === rewardLabel)) failures.push(`完整主线/${code}: 缺少固定奖励 ${rewardLabel}`);
  }
}

const obsoleteFiles = ["main_kunwu_opening_record.json", "side_kunwu_four_quests.json"].filter((file) => storyFiles.includes(file));
if (obsoleteFiles.length) failures.push(`仍存在旧剧情配置：${obsoleteFiles.join("、")}`);

function projectStats(project) {
  return {
    chapters: project.chapters.length,
    scenes: project.scenes.length,
    nodes: project.scenes.reduce((sum, scene) => sum + scene.nodes.length, 0),
    dialogueLines: project.scenes.reduce((sum, scene) => sum + actualDialogueLineCount(scene), 0),
    decisions: project.scenes.reduce((sum, scene) => sum + scene.nodes.filter((node) => node.type === "choice" || node.type === "check").length, 0),
    rewards: project.scenes.reduce((sum, scene) => sum + (scene.rewards?.length ?? 0), 0),
    locatedScenes: project.scenes.filter((scene) => scene.locationContext?.kind !== "unknown").length,
    sourceSnapshots: project.scenes.filter((scene) => scene.source?.markdown).length,
  };
}

console.log(JSON.stringify({
  main: projectStats(mainProject),
  side: projectStats(sideProject),
  sourceCoverage: {
    currentMainScenes: currentMainCodes().length,
    detailedMainSections: detailedMainCodes().length,
    currentSideScenes: currentSideCodes().length,
    longSideSections: longSideCodes().length,
  },
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
