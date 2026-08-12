import "server-only";

import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoryProject } from "./story-types";

const storiesDirectory = path.join(process.cwd(), "data", "stories");
const validId = /^[a-z0-9][a-z0-9_-]*$/;

function storyPath(id: string) {
  if (!validId.test(id)) throw new Error("INVALID_STORY_ID");
  return path.join(storiesDirectory, `${id}.json`);
}

export async function listStories(): Promise<StoryProject[]> {
  await mkdir(storiesDirectory, { recursive: true });
  const files = (await readdir(storiesDirectory)).filter((file) => file.endsWith(".json"));
  const projects = await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(path.join(storiesDirectory, file), "utf8"))),
  );
  return (projects as StoryProject[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getStory(id: string): Promise<StoryProject | null> {
  try {
    return JSON.parse(await readFile(storyPath(id), "utf8")) as StoryProject;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveStory(project: StoryProject): Promise<StoryProject> {
  await mkdir(storiesDirectory, { recursive: true });
  const saved = { ...project, updatedAt: new Date().toISOString() };
  const target = storyPath(saved.id);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(saved, null, 2)}\n`, "utf8");
  await rename(temporary, target);
  return saved;
}

export function createStoryTemplate(id: string, title: string): StoryProject {
  const now = new Date().toISOString();
  const sceneId = `${id}_scene_001`;
  return {
    schemaVersion: 2,
    id,
    category: "main",
    title,
    subtitle: "新建剧情",
    synopsis: "补充这段剧情的目标与梗概。",
    version: "0.1-draft.1",
    status: "draft",
    updatedAt: now,
    updatedBy: "剧情策划",
    sourceDocuments: [],
    variables: [],
    chapters: [{ id: `${id}_chapter_01`, code: "C1", title: "第一章", summary: "", order: 1 }],
    scenes: [
      {
        id: sceneId,
        chapterId: `${id}_chapter_01`,
        code: "C1-01",
        title: "新场景",
        trigger: "待配置",
        location: "待配置",
        locationContext: {
          kind: "unknown",
          mapIds: [],
          mapNames: [],
          areaName: "待配置",
          timeline: "待配置",
          explorationMode: "unknown",
          certainty: "inferred",
          sourceText: "待配置",
        },
        characters: [],
        description: "",
        entryNodeId: `${sceneId}_entry`,
        updatedAt: now,
        nodes: [
          {
            id: `${sceneId}_entry`,
            type: "entry",
            position: { x: 80, y: 180 },
            data: { title: "场景入口", description: "剧情开始" },
          },
          {
            id: `${sceneId}_dialogue`,
            type: "dialogue",
            position: { x: 380, y: 160 },
            data: {
              title: "第一段对话",
              lines: [{ id: "line_1", speakerId: "", speakerName: "旁白", text: "在此输入台词。" }],
            },
          },
          {
            id: `${sceneId}_ending`,
            type: "ending",
            position: { x: 720, y: 180 },
            data: { title: "场景结束", description: "完成场景" },
          },
        ],
        edges: [
          { id: "edge_entry_dialogue", source: `${sceneId}_entry`, target: `${sceneId}_dialogue` },
          { id: "edge_dialogue_ending", source: `${sceneId}_dialogue`, target: `${sceneId}_ending` },
        ],
      },
    ],
  };
}
