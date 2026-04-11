import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPlatformEmail } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre"),
  email: z.string().trim().email("Ingresa un correo válido"),
  phone: z.string().trim().optional().default(""),
  reason: z.string().trim().min(2, "Ingresa el motivo"),
  message: z.string().trim().min(10, "Escribe un mensaje más completo")
});

function getSupportInboxEmail() {
  return (
    process.env.SUPPORT_EMAIL?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "contacto@wetask.cl"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = contactSchema.parse(body);

    const supportInbox = getSupportInboxEmail();
    const safePhone = input.phone.trim() || "No informado";

    await sendPlatformEmail({
      to: supportInbox,
      subject: `Nuevo contacto WeTask: ${input.reason}`,
      text: [
        "Llegó un nuevo mensaje desde Ayuda y soporte de WeTask.",
        "",
        `Nombre: ${input.name}`,
        `Correo: ${input.email}`,
        `Teléfono: ${safePhone}`,
        `Motivo: ${input.reason}`,
        "",
        "Mensaje:",
        input.message
      ].join("\n"),
      html: `
        <div style="margin:0;padding:32px 16px;background:#eef4fb;font-family:Arial,sans-serif;color:#17324d;">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 46px rgba(21,58,97,0.14);border:1px solid rgba(34,97,160,0.12);">
            <div style="padding:28px 32px 18px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);">
              <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#d8ecff;">Nuevo mensaje de contacto</p>
              <h1 style="margin:10px 0 0;font-size:28px;line-height:1.12;color:#ffffff;">${input.reason}</h1>
            </div>
            <div style="padding:28px 32px 32px;">
              <div style="display:grid;gap:10px;margin:0 0 24px;padding:18px 20px;border-radius:20px;background:#f4f8fd;border:1px solid rgba(29,127,198,0.18);">
                <p style="margin:0;"><strong>Nombre:</strong> ${input.name}</p>
                <p style="margin:0;"><strong>Correo:</strong> ${input.email}</p>
                <p style="margin:0;"><strong>Teléfono:</strong> ${safePhone}</p>
                <p style="margin:0;"><strong>Motivo:</strong> ${input.reason}</p>
              </div>
              <div style="padding:20px;border-radius:20px;background:#ffffff;border:1px solid rgba(34,97,160,0.12);">
                <p style="margin:0 0 8px;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#1d7fc6;">Mensaje</p>
                <p style="margin:0;font-size:16px;line-height:1.7;color:#48627d;white-space:pre-wrap;">${input.message}</p>
              </div>
            </div>
          </div>
        </div>
      `
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo enviar el mensaje",
          detail: error.issues[0]?.message || "Revisa los datos ingresados"
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo enviar el mensaje",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
