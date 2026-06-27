import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      credits: number;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    credits?: number;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        // On sign-in, fetch credits from DB
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: { credits: true },
        });
        token.credits = dbUser?.credits ?? 10;
      }
      if (trigger === "update" && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { credits: true },
        });
        token.credits = dbUser?.credits ?? 10;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (typeof token.credits === "number") {
        session.user.credits = token.credits;
      }
      return session;
    },
  },
});
