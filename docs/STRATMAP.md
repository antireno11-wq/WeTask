# STRATMAP - WeTask Marketplace

Fecha de corte: 2026-02-24
Estado base: MVP funcional web + API marketplace + auth por sesión + demo data

## 1) Objetivo de negocio
Lanzar un marketplace de servicios al hogar con reservas por hora, pricing claro y operación confiable, priorizando conversión, cumplimiento del servicio y margen unitario positivo.

## 2) Norte (12 meses)
- Activar demanda recurrente (clientes que repiten)
- Mantener oferta confiable (pros con disponibilidad real)
- Reducir fricción de compra (búsqueda -> reserva -> pago)
- Escalar operaciones con control de calidad y disputas

## 3) Estado actual (ya construido)
- Front marketplace: landing, catálogo, profesionales, reserva, panel cliente/pro/admin
- Matching inicial por distancia + disponibilidad
- Flujo de booking con lock de slot y confirmación de pago simulada
- Chat, reseñas, disputas y payout request en backend
- Auth por cookie HttpOnly con roles y middleware
- Seed/demo operacional para pruebas end-to-end

## 4) Brechas críticas para producción
- Pagos reales (hoy es confirmación simulada)
- Identidad/autenticación robusta (hoy sesión custom)
- Notificaciones transaccionales (email/whatsapp/push)
- Observabilidad y analítica de embudo
- Hardening antifraude/abuso y policy operacional

## 5) Fases de ejecución

## Fase 1 - Go-Live técnico (0-4 semanas)
Objetivo: cobrar de verdad y operar sin procesos manuales frágiles.

Entregables:
- Stripe real: Payment Intents + webhooks + estados idempotentes
- Refund/cancelación básica por reglas
- Auditoría de bookings/pagos (event log)
- Monitoreo mínimo (errores API, latencia, tasa de fallos)
- Feature flags para encender/apagar módulos críticos

KPI de salida:
- >95% de pagos completados sin intervención manual
- <1% de reservas con inconsistencia de estado

## Fase 2 - Liquidez marketplace (4-8 semanas)
Objetivo: mejorar fill-rate y tiempo a reserva.

Entregables:
- Ranking de profesionales (distancia, rating, historial)
- Calendario/slots con reglas por zona y servicio
- Repricing simple por franja horaria y/o urgencia
- Mejoras de search UX y disponibilidad en tiempo real

KPI de salida:
- +20% fill-rate
- -25% tiempo medio desde búsqueda a checkout

## Fase 3 - Retención y confianza (8-12 semanas)
Objetivo: elevar repetición y NPS.

Entregables:
- Notificaciones lifecycle (reserva, recordatorio, completado, reseña)
- Reagendamiento y cancelación self-service
- Programa de reputación pro (badges/SLA)
- Resolución de disputas con playbooks y SLA

KPI de salida:
- +15% repeat rate cliente 30d
- Disputas resueltas dentro de SLA >90%

## Fase 4 - Escala operativa (12+ semanas)
Objetivo: crecer sin romper unit economics.

Entregables:
- Dashboard de cohortes y unit economics
- Motor básico de anti-no-show/fraude
- Automatización de soporte y QA operacional
- Expansión por zonas/categorías con criterios de rentabilidad

KPI de salida:
- Margen de contribución positivo por categoría prioritaria
- CAC payback dentro de objetivo definido por canal

## 6) Workstreams permanentes
- Producto: conversión, UX de reserva, pricing
- Supply: onboarding/calidad de pros, cobertura geográfica
- Ops: SLA, incidentes, disputas, payouts
- Data: tracking eventos, embudo, cohortes
- Compliance: T&C, privacidad, evidencia de servicio

## 7) Riesgos y mitigación
- Doble reserva / race conditions -> locks + idempotencia + reconciliación
- Fallas de pago -> retries, fallback, alertas tempranas
- Baja oferta en horas pico -> incentivos y pricing por franja
- Mala experiencia inicial -> QA de primeros 100 servicios

## 8) Backlog priorizado inmediato
1. Integrar Stripe real con webhooks y pruebas de idempotencia
2. Implementar notificaciones transaccionales mínimas
3. Instrumentar eventos de funnel (view/search/select/pay/complete)
4. Definir tablero operativo diario (bookings, fallos, disputas, payout)
5. Endurecer reglas de cancelación/reembolso

## 9) Definición de éxito de corto plazo (próximo hito)
En 6 semanas, el producto debe permitir:
- Reserva y pago real end-to-end
- Operación diaria con métricas confiables
- Tiempos de respuesta y resolución definidos
