import { NextResponse } from "next/server";
import { getStory, saveStory } from "@/lib/story-data";
import type { StoryProject } from "@/lib/story-types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const project = await getStory(id);
  if (!project) return NextResponse.json({ message: "剧情不存在" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const project = (await request.json()) as StoryProject;
  if (project.id !== id) return NextResponse.json({ message: "剧情 ID 不一致" }, { status: 400 });
  try {
    return NextResponse.json(await saveStory(project));
  } catch {
    return NextResponse.json({ message: "保存失败，请稍后重试" }, { status: 500 });
  }
}
