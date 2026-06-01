import { NextRequest, NextResponse } from "next/server";
import { safeErrorDetail } from "@/lib/logger";
import { requireAdminRequest } from "@/lib/admin-access";
import { getPresignedReadUrl, isStorageConfigured, isStorageKey } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Almacenamiento de archivos no está configurado en el servidor" },
      { status: 503 }
    );
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key || !isStorageKey(key)) {
    return NextResponse.json({ error: "Key inválida" }, { status: 400 });
  }

  try {
    const url = await getPresignedReadUrl({ key, expiresInSeconds: 3600 });
    return NextResponse.json({ url, expiresInSeconds: 3600 }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo generar la URL de lectura",
        detail: safeErrorDetail(error)
      },
      { status: 500 }
    );
  }
}
