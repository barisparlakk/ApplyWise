import "server-only";

import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

import { authOptions } from "@/lib/auth";
import { createBackendJwt } from "@/lib/backend-jwt";

export type BackendSession = Session & {
  backendToken: string;
};

function usesSecureSessionCookie() {
  return (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
}

function createBackendToken(token: JWT | null): string | null {
  if (
    !token ||
    typeof token.email !== "string" ||
    token.backendEmailVerified !== true
  ) {
    return null;
  }

  const subject = token.backendSubject ?? token.sub ?? token.email;
  if (typeof subject !== "string") {
    return null;
  }

  return createBackendJwt({
    subject,
    email: token.email,
    emailVerified: token.backendEmailVerified === true,
    name: typeof token.name === "string" ? token.name : null,
    githubAccessToken:
      typeof token.githubAccessToken === "string" ? token.githubAccessToken : null,
  });
}

export async function backendTokenFromRequest(request: NextRequest): Promise<string | null> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: usesSecureSessionCookie(),
  });
  return createBackendToken(token);
}

async function backendTokenFromServerCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const request = new NextRequest(process.env.NEXTAUTH_URL ?? "http://localhost:3000", {
    headers: {
      cookie: cookieStore.toString(),
    },
  });
  return backendTokenFromRequest(request);
}

export async function getBackendSession(): Promise<BackendSession | null> {
  const [session, backendToken] = await Promise.all([
    getServerSession(authOptions),
    backendTokenFromServerCookies(),
  ]);

  if (!session?.user || !backendToken) {
    return null;
  }
  return { ...session, backendToken };
}
