# Roadmap end-to-end — de MVP a producto adictivo

Objetivo: que cualquier persona pueda, sin fricción y con UI de clase mundial, recorrer el flujo completo:
**enrolarse → antecedentes verificados → aprobado → publicar servicio → ser contratado → reservar → pagar → dinero retenido → servicio ejecutado → pago liberado → calificación guardada**.

Cada fase está pensada como un **incremento entregable** (al cerrarla, el usuario ve y siente algo nuevo y completo). Estimaciones asumen 1 senior full-stack + 1 diseñador (medio tiempo). Multiplica por 1.5 si trabajas solo.

---

## Fase 0 — Detener las hemorragias (1 semana)

**Qué cambia para el usuario:** nada visible. Pero deja de ser posible perder plata o secuestrar cuentas.

**Trabajo técnico (bloqueante; sin esto no se abre a beta):**
1. Eliminar `/api/marketplace/bookings/[id]/payment/confirm` (camino simulado) y dejar `/api/bookings/checkout` como único camino de pago.
2. Reemplazar `/api/auth/oauth` por NextAuth con verificación real de id-token Google/Apple.
3. Borrar el path legacy de cookie sin firma (`decodeLegacySessionCookie` en middleware + auth.ts).
4. Fallar al boot si `SESSION_SECRET` está vacío en producción; borrar el fallback `"dev-insecure-change-me"`.
5. Restringir `serverActions.allowedOrigins` al dominio real.
6. Deshabilitar `ALLOW_HEADER_AUTH` en producción.
7. Restaurar `prisma/schema.prisma` al working tree y agregar guard en CI.
8. Gatear `ensureMarketplaceDemoData()` detrás de `SEED_DEMO_DATA=true`; deshabilitar `/api/marketplace/demo` en prod.
9. Conectar Sentry (gratis) para errores backend.

**Definición de cierre:** el equipo puede invitar a 10 amigos sin riesgo de fraude o takeover.

---

## Fase 1 — Un solo camino real de dinero, con escrow verdadero (3–4 semanas)

**Qué cambia para el usuario:** existe una sola forma de pagar, la plata realmente queda retenida, y los reembolsos vuelven al cliente. Los taskers reciben su pago automáticamente.

### 1.1 Camino canónico de reserva (5 días)
- Borrar `POST /api/marketplace/bookings` legacy.
- `/api/bookings/checkout` queda como único punto de entrada.
- Extraer `src/lib/booking-state-machine.ts` con tabla de transiciones permitidas; rechazar transiciones inválidas en cada route.
- Quitar valores muertos del enum `BookingStatus` (`PENDING`, `DISPUTE_OPEN`, `PAID_OUT` si no van a usarse).

### 1.2 Webhook robusto (3 días)
- Verificar `x-signature` + `x-request-id` de MercadoPago.
- Tabla `ProcessedWebhookEvent(provider, eventId)` para idempotencia real.
- Reintentos visibles (devolver 5xx para que MP reintente; loguear en Sentry).

### 1.3 Refund real en disputas (3 días)
- `PATCH /api/marketplace/admin/disputes` debe llamar a `refundProviderPayment("MERCADOPAGO", ...)` cuando hay `refundAmountClp > 0`.
- Sólo persistir `REFUNDED` después de respuesta exitosa del proveedor.
- Manejar refund parcial vs total.

### 1.4 Escrow real + payout automático (8–10 días) — **la decisión clave**

Tienes que escoger uno de dos modelos:

**Opción A — MercadoPago Marketplace (escrow nativo)**
- Cada tasker conecta su cuenta de MP a WeTask vía OAuth (`/sandbox/oauth`).
- WeTask cobra como "collector"; al confirmar el servicio (o pasar el plazo sin disputa) se hace `release` al collector real (el tasker).
- Pro: el dinero nunca toca la cuenta WeTask, escrow es real, MP maneja conciliación.
- Contra: requiere que cada tasker tenga cuenta MP; flujo de onboarding más largo.

**Opción B — WeTask como agente recaudador**
- WeTask cobra todo, retiene en su cuenta MP, y al liberar dispara `Money Out` (transferencia bancaria) al tasker.
- Pro: tasker sólo necesita cuenta bancaria, no MP.
- Contra: WeTask debe declarar y mantener un balance grande; implicancias tributarias chilenas (puede requerir SII boleta de honorarios o factura).

**Recomendación:** Opción A para escala, Opción B sólo si el equipo legal/contable lo respalda.

Una vez decidida la opción:
- Implementar transición `Payout.status PENDING → PROCESSING → PAID/FAILED` con llamadas reales al proveedor.
- Cron horario (QStash o Vercel Cron) que ejecute `process-timeouts` y libere automáticamente reservas con 24h sin disputa.
- Reconciliación diaria que compare estado MP vs DB.

### 1.5 Audit log de admin (2 días)
- `AdminAuditLog(actorId, action, targetType, targetId, before, after, createdAt)`.
- Helper `recordAdminAction(...)` invocado desde cada route de admin (refund, dispute, role grant, user edit).

### 1.6 Rate limiting (1 día)
- `@upstash/ratelimit` en `/api/auth/*`, `/api/onboarding/public/phone/*`, `/api/admin/payments/refund`.

**Definición de cierre:** un cliente puede pagar, ver el dinero retenido, el servicio ocurre, el tasker recibe la transferencia automática a su banco, sin que ningún admin haga clic.

---

## Fase 2 — KYC automatizado y aprobación inteligente (3–4 semanas)

**Qué cambia para el usuario (tasker):** se enrola, sube documentos una vez, recibe respuesta en minutos (no días), y si es caso limpio queda activo sin intervención humana.

### 2.1 Object storage (3 días)
- Migrar identity documents, selfies, antecedentes y attachments de chat de **base64 en Postgres** a **S3 (o Cloudflare R2)** con presigned URLs.
- Backfill de filas existentes (script one-shot).
- Admin viewer usa signed URLs con TTL corto.
- Quita ~95% del peso de tablas críticas.

### 2.2 Integración KYC chilena (5–7 días)
- Integrar proveedor (recomendado: **Truora** o **Equifax Chile** o **Datacrédito**, los tres tienen APIs).
- Endpoints: `/api/onboarding/cleaning/kyc/start` y `/api/onboarding/cleaning/kyc/callback`.
- Verificar:
  - Identidad (RUT + selfie liveness)
  - Antecedentes penales
  - Sanctions list (PEP, OFAC)
- Guardar score y eventos en `KycCheck` table.

### 2.3 Aprobación automática + cola de excepciones (3 días)
- Si KYC score es OK y no hay flags → status `APROBADO` automático, email + push "Tu cuenta está lista".
- Si hay flags → cae a cola de admin con razón explícita.
- El admin sólo ve los casos flagged; reduce trabajo manual ~80%.

### 2.4 Notificaciones de cambio de estado (2 días)
- Email transaccional via Resend (ya existe template base).
- Push notification web (service worker + Web Push) — primer caso de uso del push.
- Estado visible en el dashboard del tasker en tiempo real.

### 2.5 "Tu perfil ya está visible" — momento emocional (2 días)
- Página celebrativa cuando se activa (`status="ACTIVO"`).
- Preview de cómo te ven los clientes.
- CTA "Publica tus horarios ahora" → directo al editor de slots.

**Definición de cierre:** un nuevo tasker puede pasar de "no tengo cuenta" a "estoy activo y visible" en menos de 30 minutos sin que un humano de WeTask haga clic.

---

## Fase 3 — Fundaciones de UI de clase mundial (4–5 semanas)

**Qué cambia para el usuario:** todas las pantallas empiezan a sentirse rápidas, consistentes, y mobile-first. Esto es la inversión que habilita las fases 4 y 5.

### 3.1 Sistema de diseño (8–10 días)
- Adoptar **Tailwind CSS** + **shadcn/ui** (puedes mantener Manrope/Space Grotesk).
- Definir design tokens en `tailwind.config.ts`: spacing, type scale, radius, shadow, color.
- Construir primitivos en `src/components/ui/`:
  - `Button`, `IconButton`, `Card`, `Input`, `Textarea`, `Select`, `Combobox`, `DatePicker`, `TimePicker`, `Modal`, `Sheet` (drawer mobile), `Toast`, `Tooltip`, `Tabs`, `Avatar`, `Badge`, `Skeleton`, `Progress`, `Spinner`, `Stepper`, `RatingStars`, `EmptyState`.
- Storybook opcional pero recomendado para revisar componentes en aislamiento.

### 3.2 Migrar fuentes a `next/font` (1 día)
- Eliminar `@import` de Google Fonts en `globals.css`.
- Usar `localFont` o `Google` desde `layout.tsx`.
- Reduce CLS y bloqueo de render.

### 3.3 Descomponer mega-páginas (5–7 días)
- `trabaja-con-nosotros/registro/page.tsx` (4 933 líneas) → wizard modular con `src/app/(onboarding)/...` y un step por archivo.
- `pro/page.tsx` (1 886) → tabs Calendar / Bookings / Profile / Payouts, cada uno componente.
- `reservar/page.tsx` (1 583) → 3 pasos: Servicio · Horario · Pago.
- `cliente/page.tsx` (1 136) → tabs Reservas / Notificaciones / Tarjetas / Perfil.
- Cada componente <300 líneas.

### 3.4 Loading + error boundaries (2 días)
- `loading.tsx` con skeleton en cada ruta.
- `error.tsx` con fallback recuperable.
- `not-found.tsx` con búsqueda sugerida.

### 3.5 Microinteracciones (3 días)
- Framer Motion (o solo CSS transitions) para:
  - Slide in/out de modales y sheets.
  - Skeleton shimmer.
  - Confetti en confirmación de reserva.
  - Stars que rebotan al puntuar.
  - Pull-to-refresh nativo en PWA.

**Definición de cierre:** abrir cualquier página se siente instantáneo, el bundle de mobile baja >40%, todos los formularios usan los mismos primitivos.

---

## Fase 4 — Flujo de reserva y pago delicioso (3–4 semanas)

**Qué cambia para el usuario (cliente):** descubrir, comparar, reservar y pagar pasa de "trámite" a "experiencia". Conversión por sesión sube.

### 4.1 Búsqueda y descubrimiento (5 días)
- Página de búsqueda con:
  - Filtros (servicio, comuna, fecha, urgencia, rango precio).
  - Sort (recomendados, mejor calificados, más cercanos, más baratos).
  - Vista lista + vista mapa (Google Maps con clusters).
  - Filtros "instant book" para taskers con disponibilidad inmediata.
- Cards de tasker con: foto, rating, "X reservas completadas", "Responde en Y minutos", badge "Verificado".
- Lazy-load + skeleton.

### 4.2 Página de perfil público del tasker (3 días)
- Rediseño con foto grande, bio, badges, reviews paginadas con respuestas.
- Galería de servicios ofrecidos con precios visibles.
- Calendario de disponibilidad inline (no popup).
- CTA persistente "Reservar" en mobile (sticky bottom).

### 4.3 Wizard de reserva (5–7 días)
- 3 pasos con barra de progreso:
  1. Servicio + extras (autosave).
  2. Horario (slot hold por 5 min al seleccionar).
  3. Dirección + pago.
- Slot hold: nuevo endpoint `POST /api/bookings/slot-hold` que pone `isAvailable=false` con expiración 5 min; libera automáticamente.
- Resumen pegajoso de precio que se actualiza en vivo.
- Validación inline por campo (no al final).
- Botón principal siempre visible y con label dinámico ("Continuar" → "Pagar $12.500").

### 4.4 Pago de un toque (3–4 días)
- MercadoPago **Brick** (componente embebible) para tokenización moderna.
- Apple Pay / Google Pay activos vía Brick.
- Tarjetas guardadas con un tap.
- 3DS2 manejado por Brick.
- Estado de pago en tiempo real (sin recarga).

### 4.5 Confirmación memorable (1 día)
- Animación de confetti + check.
- Resumen con dirección, fecha, profesional y monto.
- CTA secundarios: "Agendar otra", "Compartir con el profesional", "Ver en calendario".

**Definición de cierre:** un usuario nuevo puede ir de la home a "reserva pagada" en <90 segundos, sin abandonar el flujo, con un solo formulario fluido.

---

## Fase 5 — Ejecución del servicio y cierre emocional (3–4 semanas)

**Qué cambia para el usuario:** el momento entre "reservé" y "calificación guardada" se siente cuidado y honesto. Es el ciclo que genera retención.

### 5.1 Pre-servicio (3 días)
- Recordatorio push 1 día antes y 1 hora antes.
- "Tu profesional llegará en X min" con tracking estimado (no GPS real, sólo countdown).
- Chat en tiempo real (ver 5.3).
- "Preparativos para tu servicio" (ya existe `service-preparation` route — sólo polish).

### 5.2 Check-in / check-out del tasker (4 días)
- Endpoints `POST /api/marketplace/bookings/[id]/check-in` y `/check-out`.
- Tasker abre la reserva, toca "Llegué" → push al cliente.
- Al terminar toca "Servicio completado" → push al cliente con CTA "Confirmar y calificar".
- Opcional: foto antes/después (para limpieza), firma en pantalla (para servicios técnicos).

### 5.3 Chat en tiempo real (4 días)
- Reemplazar polling por **SSE** (server-sent events, gratis y nativo) o **Pusher/Ably** si quieres typing indicators y presence.
- Notificación push al recibir mensaje fuera del chat.
- Imágenes en chat (vía object storage de Fase 2).
- Mantener `chat-safety.ts` y mejorar regex (caso "nueve seis cinco" deletreado).

### 5.4 Liberación automática del pago (2 días)
- Cron horario corre `process-timeouts` (real, no manual como hoy).
- Reglas:
  - Si cliente confirma → liberar inmediatamente.
  - Si pasan 48h sin confirmación ni disputa → liberar automáticamente.
  - Si hay disputa abierta → mantener retenido.
- Email + push al tasker "Tu pago de $X fue liberado y está en camino a tu cuenta".

### 5.5 Calificación rápida y adictiva (4–5 días)
- Push 1h después del servicio: "¿Cómo fue tu experiencia con [nombre]?"
- Pantalla de calificación rediseñada:
  - Estrellas grandes con animación al tocar.
  - Sub-scores opcionales (puntualidad, calidad, comunicación) que aparecen *después* de la estrella inicial — fricción mínima.
  - Tags pre-cargados ("muy puntual", "súper amable", "trabajo impecable") — un toque cada uno.
  - Foto y comentario opcionales.
  - Botón "Enviar" siempre visible.
- Agregación de rating dentro de `$transaction` (arregla la race condition actual).
- Confirmación: "Gracias, [nombre] verá tu reseña. ¿Reservas de nuevo?" → 1-tap re-book.

### 5.6 Respuesta del tasker a la reseña (2 días)
- Editor inline en la app del tasker para responder.
- Notificación push al cliente cuando hay respuesta.
- Visible en el perfil público.

**Definición de cierre:** el cliente recibe el servicio, lo califica en <30 segundos, el tasker recibe su pago al banco automáticamente, y la calificación queda visible en su perfil público.

---

## Fase 6 — Loops de retención y confianza (continua, empezar tras Fase 5)

**Qué cambia para el usuario:** la app se vuelve un hábito. Hay razones para volver y razones para confiar.

- **Repeat-book de un toque**: "Reservar de nuevo con [tasker]" en la confirmación y en el historial.
- **Saved searches**: "Avísame cuando [tasker] tenga disponibilidad en mi comuna".
- **Badges de profesional**: Verificado, Top-rated (4.8+), Respuesta rápida, +100 servicios, Bilingüe, etc. — visibles en cards y perfil.
- **Programa de referidos**: códigos personales, $X de crédito al cliente que invita y al invitado.
- **Crédito para retención**: $500 de crédito tras 3 servicios; sube a $1.500 tras 10.
- **Recurring bookings**: "Limpieza cada 15 días con María". Subscription nativa (uno de los drivers de retención más altos en marketplaces de aseo).
- **Notificaciones inteligentes**: "Tu reserva habitual fue cancelada, aquí hay 3 alternativas".
- **Tasker performance dashboard**: cancelación %, disputa %, tiempo de respuesta, ranking en su comuna; suspensión automática bajo umbrales.
- **Anti-fraude pasivo**: velocity checks (>3 reservas en 10 min), device fingerprint, detección de cuentas vinculadas (mismo IP cliente+tasker = self-booking).

---

## Fase 7 — Escala, observabilidad y compliance (paralela desde Fase 1)

Trabajo que no es visible para el usuario pero que evita incendios.

### 7.1 Observabilidad
- Sentry para errores (ya en Fase 0).
- Logger estructurado (`pino`) reemplazando `console.*`.
- Métricas con OpenTelemetry → Grafana Cloud (free tier) o Datadog.
- Dashboards: latencia checkout, tasa de éxito MP, tiempo medio onboarding aprobación, distribución de ratings.
- Alerts: webhooks MP fallidos >5/min, latencia checkout >3s, errores 5xx >1%.

### 7.2 Migraciones y operaciones
- `prisma migrate deploy` versionado (eliminar `prisma db push`).
- Backups Railway + restore drill documentado y probado.
- Runbook: "Postgres caído", "MP rechazando todo", "Resend bouncing", "WhatsApp/Twilio agotado".
- Status page pública (Better Stack / Atlassian Statuspage).

### 7.3 Performance a escala
- PgBouncer o Prisma Accelerate.
- Cache layer (Upstash Redis) para `Category`, `Service`, catálogo público.
- Read replica para queries de admin/analítica.
- CDN para assets estáticos.
- Bundle analyzer + presupuesto de bundle por ruta.

### 7.4 Tests + CI
- GitHub Actions con `tsc --noEmit` + `npm run lint` en cada PR.
- Vitest para `marketplace-pricing`, `booking-state-machine`, `chat-safety`, `security`.
- Playwright E2E para el flujo crítico: registro → reserva → pago → calificación (contra cuenta sandbox de MP).
- Cobertura mínima 50% de `src/lib/` antes de open-beta.

### 7.5 Compliance chileno
- Generación de boleta electrónica por servicio (OpenFactura o similar).
- Política de retención y portabilidad de datos (Ley 19.628).
- Endpoint "elimina mis datos" auditable.
- T&C versionados, registro de aceptación por versión.

---

## Calendario integrado (equipo de 1 senior + diseñador medio-tiempo)

| Semana | Fase principal | Hito visible |
| --- | --- | --- |
| 1 | Fase 0 | Sin riesgos catastróficos para invitar a 10 amigos |
| 2–5 | Fase 1 | Un flujo de pago real, retención real, payout automático |
| 6–9 | Fase 2 | Onboarding tasker en <30 min sin intervención humana |
| 10–14 | Fase 3 | UI consistente; mega-páginas eliminadas |
| 15–18 | Fase 4 | Reserva de la home al pago en <90s |
| 19–22 | Fase 5 | Ciclo completo (servicio → liberación → calificación) automatizado |
| 23+ | Fase 6 y 7 | Loops de retención + observabilidad |

**Total a beta cerrada (post Fase 1):** ~5 semanas.
**Total a beta abierta con UI digna (post Fase 4):** ~18 semanas.
**Total a producto "extremadamente fluido" (post Fase 5):** ~22 semanas.

---

## Orden de prioridad si tienes que recortar

Si presupuesto o tiempo aprietan, el orden de sacrificio recomendado:

1. **Nunca recortes Fase 0 ni Fase 1.** Sin ellas se pierde dinero y se filtran cuentas.
2. **Nunca recortes Fase 5.5** (calificación rápida). Es el motor de retención y de social proof.
3. Puedes posponer Fase 6 (loops de retención avanzados) si tienes <1000 usuarios.
4. Puedes posponer Fase 4.1 (vista mapa) y Fase 5.6 (respuesta a reseñas).
5. Puedes posponer Fase 3.5 (microinteracciones) salvo la animación de confirmación de pago.
6. La Fase 7 es continua — empieza temprano, no en bloque.

---

## Decisiones de negocio que el roadmap necesita que tomes

Antes de empezar Fase 1, hay tres preguntas que sólo tú puedes responder:

1. **¿Modelo de escrow A (MP Marketplace) o B (WeTask agente recaudador)?** Determina ~3 semanas de trabajo en Fase 1.4.
2. **¿Qué proveedor de KYC?** (Truora / Equifax Chile / Datacrédito). Determina Fase 2.2.
3. **¿Push notifications: Web Push nativo o OneSignal?** OneSignal acelera 1–2 semanas pero agrega un vendor.

Resuelve estas tres antes de cerrar el primer sprint.
