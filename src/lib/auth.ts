import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      credits: number;
      planTier?: string | null;
      planInterval?: string | null;
      planStatus?: string | null;
    } & DefaultSession["user"];
  }

  interface JWT {
    credits?: number;
    planTier?: string | null;
    planInterval?: string | null;
    planStatus?: string | null;
  }
}

async function getSessionAccountSummary(userId: string) {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    }),
    prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ["active", "trialing", "past_due", "unpaid", "incomplete"] },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        tier: true,
        interval: true,
        status: true,
      },
    }),
  ]);

  return {
    credits: user?.credits ?? 10,
    planTier: subscription?.tier ?? null,
    planInterval: subscription?.interval ?? null,
    planStatus: subscription?.status ?? null,
  };
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
        const summary = await getSessionAccountSummary(user.id as string);
        token.credits = summary.credits;
        token.planTier = summary.planTier;
        token.planInterval = summary.planInterval;
        token.planStatus = summary.planStatus;
      }
      if (trigger === "update" && token.sub) {
        const summary = await getSessionAccountSummary(token.sub);
        token.credits = summary.credits;
        token.planTier = summary.planTier;
        token.planInterval = summary.planInterval;
        token.planStatus = summary.planStatus;
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
      session.user.planTier = typeof token.planTier === "string" ? token.planTier : null;
      session.user.planInterval =
        typeof token.planInterval === "string" ? token.planInterval : null;
      session.user.planStatus = typeof token.planStatus === "string" ? token.planStatus : null;
      return session;
    },
  },
});
