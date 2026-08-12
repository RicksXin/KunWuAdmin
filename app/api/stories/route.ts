import { NextResponse } from "next/server";
import { createStoryTemplate, listStories, saveStory } from "@/lib/story-data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listStories());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string; title?: string };
  const id = body.id?.trim();
  const title = body.title?.trim();
  if (!id || !title) return NextResponse.json({ message: "剧情 ID 和名称不能为空" }, { status: 400 });

  try {
    const project = await saveStory(createStoryTemplate(id, title));
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message === "INVALID_STORY_ID"
      ? "剧情 ID 仅支持英文小写、数字、下划线和短横线"
      : "创建剧情失败";
    return NextResponse.json({ message }, { status: 400 });
  }
}
