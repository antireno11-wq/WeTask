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
- `/profesionales` Listado de profesionales con filtros, mapa de Santiago y calendario general clickeable
- `/profesionales/:proId` Ficha de profesional y calendario clickeable
- `/reservar` Flujo de reserva por horas + extras + confirmacion de pago simulada
- `/reservar` Flujo tipo app de delivery: direccion/geolocalizacion -> matching por distancia -> slot clickeable -> checkout en vivo -> pago/confirmacion
- `/cliente` Panel cliente (reservas, chat, reseñas, disputas)
- `/pro` Panel profesional (agenda, estados, cierre, payout)
- `/admin` Backoffice (reservas, reglas de categoria, disputas)

Incluye carga automatica de datos demo en Santiago (categorias, servicios, profesionales verificados con ubicacion/radio, mapa de cobertura y reservas de ejemplo) al consultar catalogo/profesionales.

### Backend / Endpoints marketplace
- `GET /api/marketplace/catalog`
- `GET /api/marketplace/pros`
- `GET /api/marketplace/search-professionals` (matching por direccion, radio y disponibilidad)
- `GET /api/marketplace/pros/:proId`
- `POST /api/marketplace/bookings`
- `GET /api/marketplace/bookings` (admin)
- `GET /api/marketplace/bookings/:bookingId`
- `PATCH /api/marketplace/bookings/:bookingId/status`
- `POST /api/marketplace/bookings/:bookingId/payment/confirm`
  - Bloquea slot seleccionado para evitar doble reserva.
- `POST /api/marketplace/bookings/:bookingId/complete`
- `POST /api/marketplace/bookings/:bookingId/payout/request`
- `GET|POST /api/marketplace/bookings/:bookingId/messages`
- `GET /api/marketplace/client/bookings`
- `GET /api/marketplace/pro/bookings`
- `GET /api/marketplace/notifications`
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

## Auth actual (rol + sesion)
- Login en `/ingresar` (usuarios demo o email existente).
- Sesion por cookie `HttpOnly` (`wetask_session`).
- Middleware protege rutas:
  - `/cliente` -> `CUSTOMER|ADMIN`
  - `/pro` -> `PRO|ADMIN`
  - `/admin` -> `ADMIN`
- Middleware protege APIs privadas bajo `/api/marketplace/*`.

Compatibilidad temporal:
- Si defines `ALLOW_HEADER_AUTH=true`, tambien acepta headers:
  - `x-user-id: <id>`
  - `x-user-role: CUSTOMER|PRO|ADMIN`

## Deploy en Railway
1. Conecta repo.
2. Agrega PostgreSQL.
3. Variables:
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
4. Railway ejecuta en start:
- `prisma migrate deploy`
- `next start`

## Seed
```bash
npm run prisma:seed
```

Carga categorias/servicios demo, usuarios (`cliente-demo`, `pro-demo`, `admin-demo`), perfil profesional verificado y disponibilidad.

## Siguiente paso recomendado
1. Integrar proveedor real (Clerk/Auth0) sobre el flujo actual de sesion.
2. Integrar Stripe real (Payment Intent + webhook + refund).
3. Upload real de fotos para chat y detalle de trabajo.
4. Notificaciones (email/whatsapp/push) por estado.
