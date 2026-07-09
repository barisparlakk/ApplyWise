const developmentSecret = "dev-nextauth-secret-change-me";
const developmentJwtSecret = "dev-applywise-auth-secret-change-me";

if (process.env.APP_ENV !== "production") {
  process.exit(0);
}

const errors = [];
const nextAuthUrl = process.env.NEXTAUTH_URL ?? "";
const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? "";
const jwtSecret = process.env.AUTH_JWT_SECRET ?? "";

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

if (Boolean(process.env.GITHUB_ID) !== Boolean(process.env.GITHUB_SECRET)) {
  errors.push("GITHUB_ID and GITHUB_SECRET must be configured together.");
}
if (!githubConfigured) {
  errors.push("GitHub OAuth must be configured for production sign-in.");
}

if (errors.length) {
  console.error(`ApplyWise runtime configuration error:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
