import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!identity.userId || !identity.role) {
    return NextResponse.json({ session: null }, { status: 200 });
  }
  return NextResponse.json({ session: identity }, { status: 200 });
}
