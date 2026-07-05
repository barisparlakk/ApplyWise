import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";

import { createBackendJwt } from "@/lib/backend-jwt";

function displayNameFromEmail(email: string): string {
  return email.split("@")[0] ?? email;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
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
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "missing-github-client-id",
      clientSecret: process.env.GITHUB_SECRET ?? "missing-github-client-secret",
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.sub = user.id;
        token.backendSubject =
          account?.provider === "github" ? `github:${user.id}` : user.id;
      }

      const subject = token.backendSubject ?? token.sub ?? token.email;
      if (typeof subject === "string" && typeof token.email === "string") {
        token.backendToken = createBackendJwt({
          subject,
          email: token.email,
          name: typeof token.name === "string" ? token.name : null,
        });
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.sub === "string" ? token.sub : undefined;
      }
      session.backendToken =
        typeof token.backendToken === "string" ? token.backendToken : undefined;
      return session;
    },
  },
};
