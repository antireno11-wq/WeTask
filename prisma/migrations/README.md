# Prisma migrations

A partir de Fase 15A esta carpeta es la fuente de verdad del schema en producción.

## Cómo se aplica

- **Local (dev):** `npm run prisma:migrate:dev -- --name <descripcion>` crea una nueva migración a partir de cambios en `schema.prisma`.
- **Railway (deploy):** el `startCommand` corre `npm run prisma:migrate` (`prisma migrate deploy`) en cada deploy. Aplica migraciones nuevas pendientes y no toca las ya aplicadas.

## Bootstrap inicial en producción (UNA sola vez)

Railway tenía el schema aplicado con `prisma db push --accept-data-loss`. El primer deploy con `migrate deploy` va a fallar con `table "X" already exists` porque Prisma ve la migración `0_init` como pendiente.

**Pasos a ejecutar UNA vez en el shell de Railway antes del primer deploy con `migrate deploy`:**

```bash
npx prisma migrate resolve --applied 0_init
```

Esto marca `0_init` como ya aplicada sin volver a correr el SQL. A partir de ahí, todos los deploys siguen `migrate deploy` limpio.

## Reglas

- **Nunca** editar un archivo de migración ya commiteado y aplicado en prod.
- **Nunca** correr `prisma db push` contra la DB de producción — corrompe el historial.
- Si necesitás un cambio destructivo (drop columna, drop tabla), crear migración explícita y verificar que la pérdida de datos es intencional.
- Las migraciones se aplican secuencialmente por timestamp/orden alfabético del directorio.
