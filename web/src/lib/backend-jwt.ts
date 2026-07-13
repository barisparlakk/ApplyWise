import crypto from "node:crypto";

const DEFAULT_AUTH_JWT_AUDIENCE = "applywise-api";
const DEFAULT_AUTH_JWT_ISSUER = "applywise-web";
const DEFAULT_AUTH_JWT_SECRET = "dev-applywise-auth-secret-change-me";

type BackendJwtInput = {
  subject: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  githubAccessToken?: string | null;
};

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function sign(message: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("base64url");
}

export function createBackendJwt(input: BackendJwtInput): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: input.subject,
    email: input.email.toLowerCase(),
    email_verified: input.emailVerified,
    name: input.name ?? null,
    iat: now,
    exp: now + 60 * 60,
    iss: process.env.AUTH_JWT_ISSUER ?? DEFAULT_AUTH_JWT_ISSUER,
    aud: process.env.AUTH_JWT_AUDIENCE ?? DEFAULT_AUTH_JWT_AUDIENCE,
    ...(input.githubAccessToken ? { github_access_token: input.githubAccessToken } : {}),
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(
    `${encodedHeader}.${encodedPayload}`,
    process.env.AUTH_JWT_SECRET ?? DEFAULT_AUTH_JWT_SECRET,
  );

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
