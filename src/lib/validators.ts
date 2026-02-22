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
