import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { backendTokenFromRequest } from "@/lib/server-auth";

export const runtime = "nodejs";

type BackendRouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

const FORWARDED_REQUEST_HEADERS = ["accept", "content-type"];
const FORWARDED_RESPONSE_HEADERS = [
  "content-disposition",
  "content-type",
  "retry-after",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "x-request-id",
];

class RequestBodyTooLargeError extends Error {}

async function readRequestBody(
  request: NextRequest,
  maxBodyBytes: number,
): Promise<ArrayBuffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD" || !request.body) {
    return undefined;
  }

  const chunks: Uint8Array[] = [];
  const reader = request.body.getReader();
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBodyBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer as ArrayBuffer;
}

async function proxyRequest(request: NextRequest, context: BackendRouteContext) {
  const { path } = await context.params;
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://api:8000";
  const target = new URL(path.map(encodeURIComponent).join("/"), `${baseUrl.replace(/\/$/, "")}/`);
  target.search = request.nextUrl.search;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const maxBodyBytes = Number(process.env.MAX_REQUEST_BODY_BYTES ?? "16777216");
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength > maxBodyBytes) {
    return NextResponse.json(
      { detail: "Request body is too large." },
      { status: 413, headers: { "X-Request-ID": requestId } },
    );
  }

  const headers = new Headers();
  FORWARDED_REQUEST_HEADERS.forEach((name) => {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  });
  headers.set("x-request-id", requestId);

  const isPublicHealthRequest = path.length === 1 && path[0] === "health";
  if (!isPublicHealthRequest) {
    const backendToken = await backendTokenFromRequest(request);
    if (!backendToken) {
      return NextResponse.json(
        { detail: "Authentication required." },
        { status: 401, headers: { "X-Request-ID": requestId } },
      );
    }
    headers.set("authorization", `Bearer ${backendToken}`);
  }

  try {
    const body = await readRequestBody(request, maxBodyBytes);
    const response = await fetch(target, {
      body,
      cache: "no-store",
      headers,
      method: request.method,
      signal: AbortSignal.timeout(Number(process.env.API_PROXY_TIMEOUT_MS ?? "120000")),
    });
    const responseHeaders = new Headers();
    FORWARDED_RESPONSE_HEADERS.forEach((name) => {
      const value = response.headers.get(name);
      if (value) {
        responseHeaders.set(name, value);
      }
    });

    const responseBody = [204, 205, 304].includes(response.status)
      ? null
      : await response.arrayBuffer();
    return new NextResponse(responseBody, {
      headers: responseHeaders,
      status: response.status,
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { detail: "Request body is too large." },
        { status: 413, headers: { "X-Request-ID": requestId } },
      );
    }
    return NextResponse.json(
      { detail: "ApplyWise API is unavailable." },
      { status: 503, headers: { "X-Request-ID": requestId } },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
