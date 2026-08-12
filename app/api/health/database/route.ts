import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/server/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = performance.now();
  try {
    const database = await checkDatabaseConnection();
    return NextResponse.json({
      status: "ok",
      database: { ...database, latencyMs: Math.round(performance.now() - startedAt) },
    });
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json(
      { status: "error", message: "数据库连接不可用" },
      { status: 503 },
    );
  }
}
