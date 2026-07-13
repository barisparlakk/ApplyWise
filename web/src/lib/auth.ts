import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

function displayNameFromEmail(email: string): string {
  return email.split("@")[0] ?? email;
}

export const emailLoginEnabled = process.env.APP_ENV !== "production";
const githubClientId = process.env.GITHUB_ID;
const githubClientSecret = process.env.GITHUB_SECRET;
export const githubLoginEnabled = Boolean(githubClientId && githubClientSecret);
const googleClientId = process.env.GOOGLE_ID;
const googleClientSecret = process.env.GOOGLE_SECRET;
export const googleLoginEnabled = Boolean(googleClientId && googleClientSecret);

const providers: NonNullable<NextAuthOptions["providers"]> = [];

if (emailLoginEnabled) {
  providers.push(
    CredentialsProvider({
      id: "email",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();

        if (!email || !email.includes("@")) {
          return null;
        }

        return {
          id: `email:${email}`,
          email,
          name: displayNameFromEmail(email),
        };
      },
    }),
  );
}

if (githubClientId && githubClientSecret) {
  providers.push(
    GitHubProvider({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
      userinfo: {
        async request({ client, tokens }) {
          const accessToken = tokens.access_token;
          if (typeof accessToken !== "string") {
            throw new Error("GitHub did not return an access token.");
          }
          const profile = await client.userinfo(accessToken);
          const response = await fetch("https://api.github.com/user/emails", {
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${accessToken}`,
              "X-GitHub-Api-Version": "2022-11-28",
            },
          });
          if (!response.ok) {
            return { ...profile, email: undefined, email_verified: false };
          }
          const emails = (await response.json()) as Array<{
            email?: unknown;
            primary?: unknown;
            verified?: unknown;
          }>;
          const verifiedEmail =
            emails.find((entry) => entry.primary === true && entry.verified === true) ??
            emails.find((entry) => entry.verified === true);
          return {
            ...profile,
            email: typeof verifiedEmail?.email === "string" ? verifiedEmail.email : undefined,
            email_verified: Boolean(verifiedEmail),
          };
        },
      },
    }),
  );
}

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "email") {
        return Boolean(user.email);
      }
      return Boolean(
        user.email &&
          typeof profile === "object" &&
          profile !== null &&
          "email_verified" in profile &&
          profile.email_verified === true,
      );
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.sub = user.id;
        token.backendSubject =
          account?.provider === "github" || account?.provider === "google"
            ? `${account.provider}:${user.id}`
            : user.id;
        token.backendEmailVerified =
          account?.provider === "email" ||
          (typeof profile === "object" &&
            profile !== null &&
            "email_verified" in profile &&
            profile.email_verified === true);
      }
      if (account?.provider === "github" && typeof account.access_token === "string") {
        token.githubAccessToken = account.access_token;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.sub === "string" ? token.sub : undefined;
      }
      return session;
    },
  },
};
