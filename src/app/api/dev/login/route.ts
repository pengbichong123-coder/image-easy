// DEV-ONLY: fake sign-in for screenshots / local testing.
// Only active when NODE_ENV !== 'production'.
// Usage: GET /api/dev/login?email=demo@example.com&redirect=/create
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { encode } from "@auth/core/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email") || "demo@example.com";
  const redirect = searchParams.get("redirect") || "/create";

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: "Demo User",
        credits: 42,
        image: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(email)}`,
      },
    });
  }

  const sessionToken = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
      credits: user.credits,
    },
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
  });

  const url = new URL(redirect, req.url);
  const res = NextResponse.redirect(url);
  res.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
