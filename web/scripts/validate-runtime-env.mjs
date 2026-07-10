const developmentSecret = "dev-nextauth-secret-change-me";
const developmentJwtSecret = "dev-applywise-auth-secret-change-me";

if (process.env.APP_ENV !== "production") {
  process.exit(0);
}

const errors = [];
const nextAuthUrl = process.env.NEXTAUTH_URL ?? "";
const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? "";
const jwtSecret = process.env.AUTH_JWT_SECRET ?? "";
const supportEmail = process.env.SUPPORT_EMAIL ?? "";
const maxBodyBytes = Number(process.env.MAX_REQUEST_BODY_BYTES ?? "");
const proxyTimeoutMs = Number(process.env.API_PROXY_TIMEOUT_MS ?? "");

if (!nextAuthUrl.startsWith("https://")) {
  errors.push("NEXTAUTH_URL must use HTTPS in production.");
}
if (nextAuthSecret.length < 32 || nextAuthSecret === developmentSecret) {
  errors.push("NEXTAUTH_SECRET must be a non-default value with at least 32 characters.");
}
if (jwtSecret.length < 32 || jwtSecret === developmentJwtSecret) {
  errors.push("AUTH_JWT_SECRET must be a non-default value with at least 32 characters.");
}
const githubConfigured = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET);
const googleConfigured = Boolean(process.env.GOOGLE_ID && process.env.GOOGLE_SECRET);

if (Boolean(process.env.GITHUB_ID) !== Boolean(process.env.GITHUB_SECRET)) {
  errors.push("GITHUB_ID and GITHUB_SECRET must be configured together.");
}
if (Boolean(process.env.GOOGLE_ID) !== Boolean(process.env.GOOGLE_SECRET)) {
  errors.push("GOOGLE_ID and GOOGLE_SECRET must be configured together.");
}
if (!githubConfigured && !googleConfigured) {
  errors.push("At least one social OAuth provider must be configured for production sign-in.");
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) || supportEmail.endsWith(".example")) {
  errors.push("SUPPORT_EMAIL must be a real monitored address.");
}
if (!Number.isInteger(maxBodyBytes) || maxBodyBytes <= 0) {
  errors.push("MAX_REQUEST_BODY_BYTES must be a positive integer.");
}
if (!Number.isInteger(proxyTimeoutMs) || proxyTimeoutMs <= 0) {
  errors.push("API_PROXY_TIMEOUT_MS must be a positive integer.");
}

if (errors.length) {
  console.error(`ApplyWise runtime configuration error:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
