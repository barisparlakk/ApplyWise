import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";

function displayNameFromEmail(email: string): string {
  return email.split("@")[0] ?? email;
}

export const emailLoginEnabled = process.env.APP_ENV !== "production";
const githubClientId = process.env.GITHUB_ID;
const githubClientSecret = process.env.GITHUB_SECRET;
export const githubLoginEnabled = Boolean(githubClientId && githubClientSecret);

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
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.sub = user.id;
        token.backendSubject =
          account?.provider === "github" ? `github:${user.id}` : user.id;
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
