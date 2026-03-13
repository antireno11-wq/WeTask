import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPlatformEmail } from "@/lib/notifications";
import { calculateTechnicianScore } from "@/lib/technician-scoring";
import { technicianRegistrationSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function normalizeRut(rawRut: string) {
  return rawRut.replace(/[^0-9kK]/g, "").toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = technicianRegistrationSchema.parse(body);

    const rut = normalizeRut(input.rut.trim());
    const email = input.email.trim().toLowerCase();

    const existingByRut = await prisma.technician.findUnique({ where: { rut } });
    if (existingByRut) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ya existe una solicitud con este RUT",
          detail: "Intento bloqueado para evitar cuentas duplicadas con el mismo RUT."
        },
        { status: 409 }
      );
    }

    // Filtro automático de seguridad: no aceptar registros sin documentos clave.
    if (!input.identityDocument || !input.identitySelfie || !input.criminalRecordFile) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faltan documentos obligatorios",
          detail: "Debes subir cédula, selfie con cédula y certificado de antecedentes."
        },
        { status: 400 }
      );
    }

    const score = calculateTechnicianScore({
      hasIdentityDocument: Boolean(input.identityDocument),
      hasIdentitySelfie: Boolean(input.identitySelfie),
      hasCriminalRecord: Boolean(input.criminalRecordFile),
      yearsExperience: input.yearsExperience,
      portfolioCount: input.portfolioImages.length,
      certificationsCount: (input.certificationFiles?.length ?? 0) + (input.certificationsText ? 1 : 0),
      hasReferences: Boolean(input.references?.trim())
    });

    const technician = await prisma.technician.create({
      data: {
        fullName: input.fullName.trim(),
        rut,
        birthDate: input.birthDate,
        phone: input.phone.trim(),
        email,
        address: input.address.trim(),
        commune: input.commune.trim(),
        lat: input.lat ?? null,
        lng: input.lng ?? null,

        specialties: input.specialties,
        yearsExperience: input.yearsExperience,
        description: input.description.trim(),
        certifications: {
          text: input.certificationsText?.trim() ?? "",
          files: input.certificationFiles ?? []
        },
        portfolioImages: input.portfolioImages,

        criminalRecordFile: input.criminalRecordFile,
        identityDocument: input.identityDocument,
        identitySelfie: input.identitySelfie,
        affidavitAccepted: input.affidavitAccepted,
        references: input.references?.trim() || null,

        coverageRadiusKm: input.coverageRadiusKm,
        availableCommunes: input.availableCommunes,
        availabilitySchedule: input.availabilitySchedule.trim(),
        transportType: input.transportType,

        score,
        source: input.source?.trim() || "trabaja-con-nosotros"
      }
    });

    await sendPlatformEmail({
      to: email,
      subject: "Recibimos tu solicitud en WeTask",
      text: "Hemos recibido tu solicitud. Nuestro equipo revisará tu perfil antes de aprobar tu cuenta."
    });

    return NextResponse.json(
      { ok: true, technicianId: technician.id, score: technician.score, status: technician.verificationStatus },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo registrar el técnico",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
