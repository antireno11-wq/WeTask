import { NextRequest, NextResponse } from "next/server";
import { safeErrorDetail } from "@/lib/logger";
import { z } from "zod";
import { getRequestIdentity } from "@/lib/auth";
import {
  STORAGE_KINDS,
  STORAGE_LIMITS,
  generateStorageKey,
  getPresignedUploadUrl,
  isStorageConfigured,
  type StorageKind
} from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

const presignSchema = z.object({
  kind: z.enum(STORAGE_KINDS),
  contentType: z.string().min(3).max(120),
  // PRO-07: obligatorio para validar el tamaño ANTES de firmar la URL. El valor
  // se firma como Content-Length en el PUT, así R2 también lo hace cumplir en el
  // objeto final (no es solo un check client-side).
  sizeBytes: z.coerce.number().int().positive()
});

export async function POST(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!identity.userId || !identity.role) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Almacenamiento de archivos no está configurado en el servidor" },
      { status: 503 }
    );
  }

  let input: z.infer<typeof presignSchema>;
  try {
    const body = await req.json();
    input = presignSchema.parse(body);
  } catch (error) {
    return NextResponse.json(
      { error: "Solicitud inválida", detail: safeErrorDetail(error) },
      { status: 400 }
    );
  }

  const limits = STORAGE_LIMITS[input.kind as StorageKind];
  if (!limits.allowedContentTypes.includes(input.contentType)) {
    return NextResponse.json(
      {
        error: "Tipo de archivo no permitido para este campo",
        allowed: limits.allowedContentTypes
      },
      { status: 415 }
    );
  }

  if (input.sizeBytes > limits.maxBytes) {
    return NextResponse.json(
      {
        error: `El archivo excede el tamaño máximo permitido (${Math.round(limits.maxBytes / 1024 / 1024)} MB)`,
        maxBytes: limits.maxBytes
      },
      { status: 413 }
    );
  }

  const key = generateStorageKey({
    userId: identity.userId,
    kind: input.kind,
    contentType: input.contentType
  });

  try {
    const uploadUrl = await getPresignedUploadUrl({
      key,
      contentType: input.contentType,
      // PRO-07: el Content-Length va firmado → R2 rechaza si el cuerpo real no
      // coincide con el tamaño ya validado contra el límite del kind.
      contentLength: input.sizeBytes,
      expiresInSeconds: 900
    });
    return NextResponse.json({ uploadUrl, key, maxBytes: limits.maxBytes }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo generar la URL de carga",
        detail: safeErrorDetail(error)
      },
      { status: 500 }
    );
  }
}
