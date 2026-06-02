#!/bin/sh
set -e

# Sincroniza el schema con la DB. Usamos `db push` (sin --accept-data-loss)
# porque la DB de prod se construyó incrementalmente con db push y le faltan
# tablas nuevas (ej. TermsVersion). Sin la flag, db push SOLO aplica cambios
# aditivos (crear tablas/columnas) y aborta si algo requiere perder datos,
# así que es seguro sobre datos productivos.
npx prisma db push --skip-generate

# Siembra la versión vigente de Términos y Condiciones (idempotente: crea v1
# solo si no existe). El "|| echo" evita cortar el arranque si el seed falla.
node scripts/seed-terms-version-v1.mjs || echo "seed de TermsVersion omitido (continuando)"

# Arranca el servidor Next.
npm run start
