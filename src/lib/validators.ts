import { BookingStatus } from "@prisma/client";
import { z } from "zod";

export const createBookingSchema = z.object({
  customerId: z.string().min(1),
  serviceId: z.string().min(1),
  scheduledAt: z.coerce.date(),
  addressLine1: z.string().min(5),
  comuna: z.string().min(2),
  region: z.string().min(2),
  notes: z.string().max(500).optional()
});

export const listBookingsQuerySchema = z
  .object({
    customerId: z.string().min(1).optional(),
    proId: z.string().min(1).optional(),
    status: z.nativeEnum(BookingStatus).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
  .refine((value) => value.customerId || value.proId, {
    message: "Debes indicar customerId o proId"
  });

export const updateBookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
  proId: z.string().min(1).optional()
});
