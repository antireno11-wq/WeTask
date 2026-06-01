-- AUTH-05: versión de sesión para invalidar cookies existentes tras un reset de contraseña.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- BOOK-02: un AvailabilitySlot no puede quedar reservado por dos Bookings a la vez.
-- Índice único parcial sobre bookedSlotId no nulo (Postgres trata NULL como distinto).
CREATE UNIQUE INDEX "Booking_bookedSlotId_key" ON "Booking"("bookedSlotId") WHERE "bookedSlotId" IS NOT NULL;
