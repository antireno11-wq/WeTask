# WeTask Marketplace MVP

Plataforma tipo Webel para servicios al hogar por hora, con precio fijo, reserva por bloques y pago dentro de plataforma.

## Stack
- Next.js 14 (App Router)
- Prisma + PostgreSQL
- API routes por rol (`CUSTOMER`, `PRO`, `ADMIN`)

## Estado actual (implementado)

### UI / Rutas
- `/` Landing marketplace
- `/catalogo` Catalogo de servicios por categoria
- `/profesionales` Listado de profesionales con filtros base
- `/profesionales/:proId` Ficha de profesional y disponibilidad
- `/reservar` Flujo de reserva por horas + extras + confirmacion de pago simulada
- `/cliente` Panel cliente (reservas, chat, reseñas, disputas)
- `/pro` Panel profesional (agenda, estados, cierre, payout)
- `/admin` Backoffice (reservas, reglas de categoria, disputas)

### Backend / Endpoints marketplace
- `GET /api/marketplace/catalog`
- `GET /api/marketplace/pros`
- `GET /api/marketplace/pros/:proId`
- `POST /api/marketplace/bookings`
- `GET /api/marketplace/bookings` (admin)
- `GET /api/marketplace/bookings/:bookingId`
- `PATCH /api/marketplace/bookings/:bookingId/status`
- `POST /api/marketplace/bookings/:bookingId/payment/confirm`
- `POST /api/marketplace/bookings/:bookingId/complete`
- `POST /api/marketplace/bookings/:bookingId/payout/request`
- `GET|POST /api/marketplace/bookings/:bookingId/messages`
- `GET /api/marketplace/client/bookings`
- `GET /api/marketplace/pro/bookings`
- `POST /api/marketplace/reviews`
- `POST /api/marketplace/disputes`
- `GET|PATCH /api/marketplace/admin/disputes`
- `PATCH /api/marketplace/admin/categories/rules`

### Modelo de datos (Prisma)
- `User`
- `ProfessionalProfile`
- `Category`
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

## Auth temporal (para pruebas)
Se valida rol por headers HTTP (hasta integrar Clerk/Auth0):
- `x-user-id: <id>`
- `x-user-role: CUSTOMER|PRO|ADMIN`

## Deploy en Railway
1. Conecta repo.
2. Agrega PostgreSQL.
3. Variables:
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
4. Railway ejecuta en start:
- `prisma generate`
- `prisma db push`
- `next start`

## Seed
```bash
npm run prisma:seed
```

Carga categorias/servicios demo, usuarios (`cliente-demo`, `pro-demo`, `admin-demo`), perfil profesional verificado y disponibilidad.

## Siguiente paso recomendado
1. Integrar auth real (Clerk/Auth0).
2. Integrar Stripe real (Payment Intent + webhook + refund).
3. Upload real de fotos para chat y detalle de trabajo.
4. Notificaciones (email/whatsapp/push) por estado.
