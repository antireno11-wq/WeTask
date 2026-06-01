-- BOOK-12: marcadores persistentes de recordatorio enviado (idempotencia robusta del cron).
ALTER TABLE "Booking" ADD COLUMN "reminder24hSentAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "reminder1hSentAt" TIMESTAMP(3);
