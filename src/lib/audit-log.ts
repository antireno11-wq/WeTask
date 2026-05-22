import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditTarget = {
  type: string;
  id?: string | null;
};

export type RecordAdminActionInput = {
  actorId: string | null;
  action: string;
  target: AuditTarget;
  before?: unknown;
  after?: unknown;
};

/**
 * Registra una acción admin en AdminAuditLog. Si se pasa `tx`, lo escribe
 * dentro de la transacción del caller (recomendado para que el log y el
 * cambio commiten juntos). Si no, hace insert standalone (best-effort).
 *
 * Los campos `before` / `after` se serializan como JSON; tipos no
 * serializables (Decimal, BigInt) se convierten a string para no perder
 * información.
 */
export async function recordAdminAction(
  input: RecordAdminActionInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  await client.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.target.type,
      targetId: input.target.id ?? null,
      beforeJson: serialize(input.before),
      afterJson: serialize(input.after)
    }
  });
}

function serialize(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  try {
    const json = JSON.parse(
      JSON.stringify(value, (_key, v) => {
        if (typeof v === "bigint") return v.toString();
        if (v && typeof v === "object" && typeof (v as { toJSON?: unknown }).toJSON === "function") {
          return (v as { toJSON: () => unknown }).toJSON();
        }
        return v;
      })
    );
    return json as Prisma.InputJsonValue;
  } catch {
    return { __serializationError: "Failed to serialize value" } as Prisma.InputJsonValue;
  }
}
