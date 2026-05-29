#!/bin/sh
set -e

# Baseline idempotente: marca la migración 0_init como aplicada si la DB
# ya tenía el schema (creado antes con `prisma db push`). Si ya está
# marcada, el comando falla y el `|| echo` lo absorbe sin cortar el deploy.
npx prisma migrate resolve --applied 0_init || echo "baseline 0_init ya aplicado, continuando"

# Aplica migraciones pendientes (no-op si no hay nuevas).
npm run prisma:migrate

# Arranca el servidor Next.
npm run start
