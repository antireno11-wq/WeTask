import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0
  });
  return response;
}
