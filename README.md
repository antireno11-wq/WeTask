# WeTask Marketplace MVP

Base para una plataforma tipo marketplace de servicios al hogar (modelo por hora), inspirada en Webel, sobre Next.js + Prisma + PostgreSQL.

## Stack
- Next.js 14 (App Router)
- Prisma + PostgreSQL
- API routes (cliente / profesional / admin)

## Estado actual
Incluye dos capas funcionales en paralelo:
- Flujo publico actual en home (`/`) para solicitar servicio y ver reservas por email.
- Nueva capa marketplace (`/api/marketplace/*`) con reglas por categoria, asignacion de profesional, reservas por horas, reseñas y endpoints por rol.

## Modelo de datos (MVP marketplace)
- `User` (roles: `CUSTOMER`, `PRO`, `ADMIN`)
- `ProfessionalProfile`
- `Category` (reglas: minimo horas, bloques, fee, recargos)
- `Service`
- `AvailabilitySlot`
- `Address`
- `Booking`
- `BookingExtra`
- `Message`
- `Payment`
- `Payout`
- `Review`
- `DisputeTicket`

## Deploy en Railway
1. Conecta repo en Railway.
2. Agrega PostgreSQL.
3. Variables requeridas:
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
4. Deploy command ya ejecuta:
- `prisma generate`
- `prisma db push`
- `next start`

## Seed inicial
Corre semilla para datos base:
```bash
npm run prisma:seed
```

Crea:
- Categorias: limpieza, manitas, electricidad.
- Servicios base.
- Usuarios demo (`CUSTOMER`, `PRO`, `ADMIN`).
- Perfil profesional verificado + disponibilidad.

## Auth temporal por headers (para pruebas)
La capa marketplace valida roles desde headers HTTP:
- `x-user-id: <id-usuario>`
- `x-user-role: CUSTOMER|PRO|ADMIN`

Nota: esto es temporal hasta integrar Clerk/Auth0.

## Endpoints existentes (legacy)
- `GET /api/health`
- `GET /api/services`
- `POST /api/bookings/public`
- `GET /api/bookings/public?email=...`
- `POST /api/bookings`
- `GET /api/bookings?customerId=...|proId=...`
- `PATCH /api/bookings/:bookingId/status`

## Endpoints marketplace (nuevo)

### Catalogo
- `GET /api/marketplace/catalog`
  - Retorna categorias activas con sus servicios activos.

### Profesionales
- `GET /api/marketplace/pros?serviceId=&city=&minRating=&verified=&maxHourlyRateClp=&limit=`
- `GET /api/marketplace/pros/:proId`

### Reservas marketplace
- `POST /api/marketplace/bookings`

Body ejemplo:
```json
{
  "customerId": "cus_123",
  "serviceId": "srv_123",
  "proId": "pro_123",
  "autoAssign": false,
  "startsAt": "2026-03-01T10:00:00.000Z",
  "hours": 2,
  "address": {
    "street": "Gran Via 12",
    "city": "Madrid",
    "postalCode": "28013",
    "region": "Madrid"
  },
  "details": "Limpieza de cocina y bano",
  "extras": {
    "materials": true,
    "urgency": false,
    "travelFeeClp": 0
  }
}
```

Calcula automaticamente:
- subtotal por hora
- extras
- fee de plataforma
- total
- crea payment en estado `PENDING`

- `GET /api/marketplace/bookings?limit=30` (solo `ADMIN`)
- `PATCH /api/marketplace/bookings/:bookingId/status` (roles `ADMIN` o `PRO`)

### Panel cliente
- `GET /api/marketplace/client/bookings?customerId=` (`CUSTOMER`/`ADMIN`)

### Panel profesional
- `GET /api/marketplace/pro/bookings?proId=` (`PRO`/`ADMIN`)

### Reseñas
- `POST /api/marketplace/reviews`
  - Solo cliente (o admin), solo reservas `COMPLETED`.
  - Recalcula `ratingAvg` y `ratingsCount` del profesional.

### Admin categorias
- `PATCH /api/marketplace/admin/categories/rules`
  - Actualiza `basePlatformFeePct`, `minHours`, `slotMinutes`.
  - Solo `ADMIN`.

## Siguiente sprint recomendado (ya alineado al prompt)
1. Integrar auth real (Clerk/Auth0) y remover headers temporales.
2. Integrar pago real (Stripe Payment Intents + webhooks).
3. Chat por reserva (`/api/marketplace/messages`) con subida de imagen.
4. Disputas y reembolsos con panel admin.
5. Paneles UI por rol (cliente/pro/admin) en rutas dedicadas.
