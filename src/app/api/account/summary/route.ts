import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAccountSummary } from "@/lib/account-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getAccountSummary(session.user.id);
  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
