import { TechnicianVerificationStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { sendPlatformEmail } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { adminTechnicianReviewSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function deny() {
  return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}

export async function GET(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!hasRole(identity.role, UserRole.ADMIN)) return deny();

  const technicians = await prisma.technician.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      commune: true,
      specialties: true,
      score: true,
      verificationStatus: true,
      createdAt: true,
      reviewNotes: true
    },
    take: 300
  });

  return NextResponse.json({ technicians }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!hasRole(identity.role, UserRole.ADMIN)) return deny();

  try {
    const body = await req.json();
    const input = adminTechnicianReviewSchema.parse(body);

    const status: TechnicianVerificationStatus =
      input.action === "approve"
        ? TechnicianVerificationStatus.APPROVED
        : input.action === "reject"
          ? TechnicianVerificationStatus.REJECTED
          : TechnicianVerificationStatus.UNDER_REVIEW;

    const technician = await prisma.technician.update({
      where: { id: input.technicianId },
      data: {
        verificationStatus: status,
        reviewNotes: input.reviewNotes?.trim() || null
      }
    });

    if (status === TechnicianVerificationStatus.APPROVED) {
      await sendPlatformEmail({
        to: technician.email,
        subject: "Tu perfil de técnico fue aprobado",
        text: "Tu perfil ha sido aprobado. Ahora puedes comenzar a recibir solicitudes de clientes."
      });
    }

    return NextResponse.json({ ok: true, technician }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo actualizar el estado",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
