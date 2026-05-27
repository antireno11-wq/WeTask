import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf"
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `El archivo supera el límite de tamaño permitido de 5MB. (Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB)` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, WEBP) o documentos PDF." },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate unique name to prevent collisions
    const fileExtension = path.extname(file.name) || ".jpg";
    const uniqueId = crypto.randomUUID();
    const filename = `${uniqueId}${fileExtension}`;
    const targetPath = path.join(uploadsDir, filename);

    // Save file buffer to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(targetPath, buffer);

    // Return the public access URL
    const fileUrl = `/uploads/${filename}`;
    
    console.info(`[storage] Archivo guardado correctamente en: ${fileUrl}`);

    return NextResponse.json(
      {
        ok: true,
        url: fileUrl,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[upload-error]", error);
    return NextResponse.json(
      {
        error: "No se pudo subir el archivo",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
