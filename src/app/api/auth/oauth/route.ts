import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      provider?: "GOOGLE" | "APPLE";
      email?: string;
      fullName?: string;
      role?: "CUSTOMER" | "PRO";
      acceptTerms?: boolean;
    };

    const provider = body.provider === "APPLE" ? "APPLE" : body.provider === "GOOGLE" ? "GOOGLE" : null;
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim();
    const role = body.role === "PRO" ? UserRole.PRO : UserRole.CUSTOMER;

    if (!provider || !email || !fullName) {
      return NextResponse.json({ error: "provider, email y fullName son requeridos" }, { status: 400 });
    }

    if (!body.acceptTerms) {
      return NextResponse.json({ error: "Debes aceptar terminos y condiciones" }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        fullName,
        authProvider: provider,
        role,
        termsAcceptedAt: new Date(),
        emailVerifiedAt: new Date()
      },
      create: {
        email,
        fullName,
        role,
        authProvider: provider,
        termsAcceptedAt: new Date(),
        emailVerifiedAt: new Date(),
        roleAssignments: {
          create: {
            role: {
              connectOrCreate: {
                where: { code: role },
                create: { code: role, label: role === UserRole.PRO ? "Tasker" : "Cliente" }
              }
            }
          }
        }
      },
      select: { id: true, email: true, fullName: true, role: true }
    });

    const dbRole = await prisma.role.upsert({
      where: { code: role },
      update: { label: role === UserRole.PRO ? "Tasker" : "Cliente" },
      create: { code: role, label: role === UserRole.PRO ? "Tasker" : "Cliente" }
    });

    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: dbRole.id
        }
      },
      update: {},
      create: {
        userId: user.id,
        roleId: dbRole.id
      }
    });

    const response = NextResponse.json({ session: user }, { status: 200 });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: encodeSessionCookie({ userId: user.id, role: user.role, email: user.email, fullName: user.fullName }),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "No se pudo autenticar con proveedor", detail: error instanceof Error ? error.message : "Error desconocido" }, { status: 400 });
  }
}
