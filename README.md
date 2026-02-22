# WeTask MVP

Base para WeTask, una app de servicios a domicilio enfocada en Chile, corriendo 100% online con GitHub + Railway.

## Stack
- Next.js 14 (App Router)
- Prisma + PostgreSQL
- API route inicial de reservas

## Qué incluye
- Estructura web inicial (`/`)
- Flujo funcional cliente en home:
  - listar servicios activos
  - solicitar reserva sin IDs internos
  - seguimiento por email
- Health check (`/api/health`)
- Endpoint para crear reservas (`POST /api/bookings`)
- Modelo de datos inicial para:
  - `User` (`CUSTOMER`, `PRO`, `ADMIN`)
  - `Service`
  - `Booking`

## Deploy online (sin instalar nada local)
1. Sube este repo a GitHub.
2. En Railway: `New Project` -> `Deploy from GitHub repo`.
3. Agrega un servicio PostgreSQL en el mismo proyecto de Railway.
4. En variables del servicio web, define:
   - `DATABASE_URL` (usar la del PostgreSQL de Railway)
   - `NEXT_PUBLIC_APP_URL` (URL pública de Railway)
5. Railway hará build/deploy automático. El `startCommand` ejecuta:
   - `prisma generate`
   - `prisma db push`
   - `next start`

## Endpoints de prueba

### 1) Health
`GET /api/health`

Respuesta esperada:
```json
{
  "ok": true,
  "service": "wetask",
  "timestamp": "2026-02-22T00:00:00.000Z"
}
```

### 2) Crear reserva
`POST /api/bookings`

Body:
```json
{
  "customerId": "id-del-cliente",
  "serviceId": "id-del-servicio",
  "scheduledAt": "2026-03-01T15:00:00.000Z",
  "addressLine1": "Av. Providencia 1234",
  "comuna": "Providencia",
  "region": "Metropolitana",
  "notes": "Tocar timbre"
}
```

### 3) Listar reservas
`GET /api/bookings?customerId=<id>&status=PENDING&limit=20`

También soporta listar por prestador:
`GET /api/bookings?proId=<id>&status=ACCEPTED&limit=20`

Notas:
- Debes enviar `customerId` o `proId`.
- `status` es opcional (`PENDING`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
- `limit` es opcional (1 a 100, default 20).

### 4) Actualizar estado de reserva
`PATCH /api/bookings/:bookingId/status`

Body:
```json
{
  "status": "ACCEPTED",
  "proId": "id-del-prestador"
}
```

Notas:
- `proId` es opcional, pero si se envía debe ser un usuario con rol `PRO`.

### 5) Listar servicios activos (flujo cliente)
`GET /api/services`

### 6) Crear reserva pública (flujo cliente)
`POST /api/bookings/public`

Body:
```json
{
  "fullName": "Maria Perez",
  "email": "maria@correo.cl",
  "phone": "+56912345678",
  "serviceId": "id-del-servicio",
  "scheduledAt": "2026-03-01T15:00:00.000Z",
  "addressLine1": "Av. Providencia 1234",
  "comuna": "Providencia",
  "region": "Metropolitana",
  "notes": "Depto 42"
}
```

### 7) Ver reservas por email (flujo cliente)
`GET /api/bookings/public?email=<correo>&limit=20`

## Próximo sprint recomendado
1. Autenticación (Clerk/Auth0) + control de roles.
2. Flujo completo cliente (crear + pagar + ver estado).
3. Panel prestador (aceptar/rechazar reservas).
4. Panel admin mínimo (gestión manual + soporte).
