import { prisma } from "@/lib/prisma";

/**
 * Devuelve el id del TermsVersion vigente (último por publishedAt). Si no
 * hay ninguna versión cargada, devuelve null — el caller decide si bloquea
 * el signup o continúa.
 *
 * Cacheado in-memory por 5 minutos para no pegar a la DB en cada signup.
 */
let cached: { id: string | null; expiresAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getCurrentTermsVersionId(): Promise<string | null> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.id;
  }

  const latest = await prisma.termsVersion.findFirst({
    orderBy: { publishedAt: "desc" },
    select: { id: true }
  });

  cached = { id: latest?.id ?? null, expiresAt: Date.now() + TTL_MS };
  return cached.id;
}
