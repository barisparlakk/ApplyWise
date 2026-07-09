import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type BackendRouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

const FORWARDED_REQUEST_HEADERS = ["authorization", "content-type"];
const FORWARDED_RESPONSE_HEADERS = ["content-disposition", "content-type"];

async function proxyRequest(request: NextRequest, context: BackendRouteContext) {
  const { path } = await context.params;
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://api:8000";
  const target = new URL(path.map(encodeURIComponent).join("/"), `${baseUrl.replace(/\/$/, "")}/`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  FORWARDED_REQUEST_HEADERS.forEach((name) => {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  });

  try {
    const response = await fetch(target, {
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      headers,
      method: request.method,
    });
    const responseHeaders = new Headers();
    FORWARDED_RESPONSE_HEADERS.forEach((name) => {
      const value = response.headers.get(name);
      if (value) {
        responseHeaders.set(name, value);
      }
    });

    return new NextResponse(await response.arrayBuffer(), {
      headers: responseHeaders,
      status: response.status,
    });
  } catch {
    return NextResponse.json({ detail: "ApplyWise API is unavailable." }, { status: 503 });
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
