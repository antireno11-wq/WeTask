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

export const publicCreateBookingSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional(),
  serviceId: z.string().min(1),
  scheduledAt: z.coerce.date(),
  addressLine1: z.string().min(5),
  comuna: z.string().min(2),
  region: z.string().min(2),
  notes: z.string().max(500).optional()
});

export const publicBookingsQuerySchema = z.object({
  email: z.string().email(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const marketplaceListProsQuerySchema = z.object({
  categoryId: z.string().optional(),
  serviceId: z.string().optional(),
  city: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  verified: z.coerce.boolean().optional(),
  maxHourlyRateClp: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const marketplaceCreateBookingSchema = z.object({
  customerId: z.string().min(1),
  serviceId: z.string().min(1),
  proId: z.string().min(1).optional(),
  slotId: z.string().min(1).optional(),
  autoAssign: z.boolean().optional().default(false),
  startsAt: z.coerce.date(),
  hours: z.coerce.number().int().min(1).max(8),
  address: z.object({
    street: z.string().min(5),
    city: z.string().min(2),
    postalCode: z.string().min(4).max(10),
    region: z.string().min(2).optional()
  }),
  details: z.string().max(1000).optional(),
  extras: z
    .object({
      materials: z.boolean().optional().default(false),
      urgency: z.boolean().optional().default(false),
      travelFeeClp: z.coerce.number().int().min(0).optional().default(0)
    })
    .optional()
    .default({ materials: false, urgency: false, travelFeeClp: 0 })
});

export const marketplaceBookingStatusUpdateSchema = z.object({
  status: z.nativeEnum(BookingStatus)
});

export const marketplaceReviewCreateSchema = z.object({
  bookingId: z.string().min(1),
  authorId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  punctuality: z.coerce.number().int().min(1).max(5).optional(),
  quality: z.coerce.number().int().min(1).max(5).optional(),
  communication: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().max(800).optional()
});

export const marketplaceAdminFeeSchema = z.object({
  categoryId: z.string().min(1),
  basePlatformFeePct: z.coerce.number().min(0).max(100),
  minHours: z.coerce.number().int().min(1).max(8),
  slotMinutes: z.coerce.number().int().refine((v) => v === 30 || v === 60, "slotMinutes debe ser 30 o 60")
});

export const marketplaceAvailabilityQuerySchema = z.object({
  serviceId: z.string().optional(),
  proId: z.string().optional(),
  city: z.string().optional(),
  date: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).max(14).default(7),
  limit: z.coerce.number().int().min(1).max(200).default(100)
});

export const marketplaceSearchProsSchema = z.object({
  city: z.string().min(2),
  postalCode: z.string().min(4).max(10),
  street: z.string().min(3).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  categoryId: z.string().min(1).optional(),
  serviceId: z.string().min(1).optional(),
  date: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const marketplaceProProfileUpdateSchema = z.object({
  proId: z.string().min(1).optional(),
  bio: z.string().max(600).optional().nullable(),
  coverageStreet: z.string().min(3).max(180).optional().nullable(),
  coverageComuna: z.string().min(2).max(120).optional().nullable(),
  coverageCity: z.string().min(2).max(120).optional().nullable(),
  coveragePostal: z.string().min(4).max(12).optional().nullable(),
  coverageLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  coverageLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  serviceRadiusKm: z.coerce.number().int().min(2).max(60).optional(),
  hourlyRateFromClp: z.coerce.number().int().min(5000).max(200000).optional().nullable()
});

export const marketplaceProSlotCreateSchema = z.object({
  proId: z.string().min(1).optional(),
  serviceId: z.string().min(1).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date()
});

export const marketplaceProSlotUpdateSchema = z.object({
  isAvailable: z.boolean()
});
