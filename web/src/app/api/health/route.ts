import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://api:8000";

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/ready`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ status: "unhealthy" }, { status: 503 });
    }

    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}
