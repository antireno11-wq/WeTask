import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { COVERAGE_UNAVAILABLE_MESSAGE, inferCommuneFromAddress, normalizeCommune, taskerServesCommune } from "@/lib/communes";
import { calculateMarketplacePrice } from "@/lib/marketplace-pricing";
import { prisma } from "@/lib/prisma";
import { syncTaskerMarketplaceServicesFromOnboarding } from "@/lib/tasker-publication";
import { hasAssignedRole } from "@/lib/user-roles";
import { marketplaceCreateBookingSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);

    if (!hasRole(identity.role, UserRole.ADMIN)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "30");

    const bookings = await prisma.booking.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: Number.isNaN(limit) ? 30 : Math.min(Math.max(limit, 1), 100),
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        pro: { select: { id: true, fullName: true, email: true } },
        service: { select: { id: true, name: true } },
        extras: true,
        payment: true
      }
    });

    return NextResponse.json({ bookings }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar reservas marketplace",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}

function requestedBookingEndsAt(startsAt: Date, hours: number) {
  return new Date(startsAt.getTime() + hours * 60 * 60 * 1000);
}

async function reserveRequestedWindow(
  tx: Prisma.TransactionClient,
  params: {
    slotId: string;
    serviceId: string;
    startsAt: Date;
    endsAt: Date;
  }
) {
  const slot = await tx.availabilitySlot.findUnique({
    where: { id: params.slotId },
    select: {
      id: true,
      professionalProfileId: true,
      serviceId: true,
      startsAt: true,
      endsAt: true,
      isAvailable: true
    }
  });

  if (!slot || !slot.isAvailable) {
    throw new Error("El horario ya fue tomado por otro cliente");
  }

  if (params.startsAt < slot.startsAt || params.endsAt <= params.startsAt) {
    throw new Error("El horario solicitado ya no cabe dentro del bloque del tasker");
  }

  const candidateSlots = await tx.availabilitySlot.findMany({
    where: {
      professionalProfileId: slot.professionalProfileId,
      isAvailable: true,
      startsAt: { lt: params.endsAt },
      endsAt: { gt: params.startsAt },
      OR: [{ serviceId: null }, { serviceId: params.serviceId }]
    },
    orderBy: [{ startsAt: "asc" }],
    select: {
      id: true,
      professionalProfileId: true,
      serviceId: true,
      startsAt: true,
      endsAt: true,
      isAvailable: true
    }
  });

  const firstIndex = candidateSlots.findIndex((candidate) => candidate.id === params.slotId);
  if (firstIndex < 0) {
    throw new Error("El horario ya fue tomado por otro cliente");
  }

  const reservedChain = [candidateSlots[firstIndex]];
  let coveredUntil = reservedChain[0].endsAt;

  for (let index = firstIndex + 1; coveredUntil < params.endsAt && index < candidateSlots.length; index += 1) {
    const nextSlot = candidateSlots[index];
    if (nextSlot.startsAt > coveredUntil) break;
    reservedChain.push(nextSlot);
    if (nextSlot.endsAt > coveredUntil) {
      coveredUntil = nextSlot.endsAt;
    }
  }

  if (coveredUntil < params.endsAt) {
    throw new Error("El horario solicitado ya no cabe dentro del bloque del tasker");
  }

  const extraWindows: Array<{
    professionalProfileId: string;
    serviceId: string | null;
    startsAt: Date;
    endsAt: Date;
    isAvailable: true;
  }> = [];

  for (const reservedSlot of reservedChain) {
    const reservationStart = reservedSlot.startsAt < params.startsAt ? params.startsAt : reservedSlot.startsAt;
    const reservationEnd = reservedSlot.endsAt > params.endsAt ? params.endsAt : reservedSlot.endsAt;

    if (reservationEnd <= reservationStart) continue;

    if (reservedSlot.startsAt < reservationStart) {
      extraWindows.push({
        professionalProfileId: reservedSlot.professionalProfileId,
        serviceId: reservedSlot.serviceId,
        startsAt: reservedSlot.startsAt,
        endsAt: reservationStart,
        isAvailable: true
      });
    }
    if (reservationEnd < reservedSlot.endsAt) {
      extraWindows.push({
        professionalProfileId: reservedSlot.professionalProfileId,
        serviceId: reservedSlot.serviceId,
        startsAt: reservationEnd,
        endsAt: reservedSlot.endsAt,
        isAvailable: true
      });
    }

    await tx.availabilitySlot.update({
      where: { id: reservedSlot.id },
      data: {
        startsAt: reservationStart,
        endsAt: reservationEnd,
        isAvailable: false
      }
    });
  }

  if (extraWindows.length > 0) {
    await tx.availabilitySlot.createMany({ data: extraWindows });
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = marketplaceCreateBookingSchema.parse(body);
    const clientCommune =
      normalizeCommune(input.address.commune) ??
      inferCommuneFromAddress(`${input.address.street}, ${input.address.city}, Chile`);

    if (!clientCommune) {
      return NextResponse.json(
        { error: COVERAGE_UNAVAILABLE_MESSAGE },
        { status: 400 }
      );
    }

    if (identity.role === UserRole.CUSTOMER && identity.userId !== input.customerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const [customer, service] = await Promise.all([
      prisma.user.findUnique({ where: { id: input.customerId }, include: { roleAssignments: { select: { role: { select: { code: true } } } } } }),
      prisma.service.findUnique({ where: { id: input.serviceId }, include: { category: true } })
    ]);

    if (!customer || !hasAssignedRole(customer, UserRole.CUSTOMER)) {
      return NextResponse.json({ error: "Cliente no válido" }, { status: 400 });
    }

    if (!service || !service.isActive || !service.category) {
      return NextResponse.json({ error: "Servicio no disponible o sin categoria configurada" }, { status: 400 });
    }

    if (input.hours < service.category.minHours) {
      return NextResponse.json(
        { error: `La categoría exige mínimo ${service.category.minHours} hora(s)` },
        { status: 400 }
      );
    }

    const requestedSlotMinutes = service.category.slotMinutes;
    const platformFeePct = Number(service.category.basePlatformFeePct);
    let baseRate = service.basePriceClp;
    const requestedEndsAt = requestedBookingEndsAt(input.startsAt, input.hours);

    let assignedProId = input.proId ?? null;
    let selectedSlotId = input.slotId ?? null;

    if (selectedSlotId) {
      const selectedSlot = await prisma.availabilitySlot.findUnique({
        where: { id: selectedSlotId },
        include: {
          professionalProfile: {
            select: {
              userId: true,
              coverageComuna: true,
              taskerServices: {
                where: {
                  serviceId: input.serviceId,
                  isActive: true
                },
                select: { id: true, priceClp: true }
              },
              user: {
                select: {
                  cleaningOnboarding: {
                    select: {
                      serviceCommunes: true,
                      baseCommune: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!selectedSlot || !selectedSlot.isAvailable) {
        return NextResponse.json({ error: "Horario no disponible" }, { status: 409 });
      }

      if (input.startsAt < selectedSlot.startsAt || requestedEndsAt <= input.startsAt) {
        return NextResponse.json({ error: "La hora elegida no cae dentro del bloque disponible" }, { status: 400 });
      }

      if (selectedSlot.serviceId && selectedSlot.serviceId !== input.serviceId) {
        return NextResponse.json({ error: "El bloque no pertenece al servicio seleccionado" }, { status: 400 });
      }
      if (selectedSlot.professionalProfile.taskerServices.length === 0) {
        await syncTaskerMarketplaceServicesFromOnboarding(selectedSlot.professionalProfile.userId);
        const syncedTaskerService = await prisma.taskerService.findFirst({
          where: {
            professionalProfileId: selectedSlot.professionalProfileId,
            serviceId: input.serviceId,
            isActive: true
          },
          select: { id: true, priceClp: true }
        });
        if (!syncedTaskerService) {
          return NextResponse.json({ error: "El tasker seleccionado no ofrece este servicio" }, { status: 400 });
        }
        selectedSlot.professionalProfile.taskerServices = [syncedTaskerService];
      }

      const slotTaskerCanServe = taskerServesCommune(
        {
          serviceCommunes: selectedSlot.professionalProfile.user.cleaningOnboarding?.serviceCommunes,
          coverageComuna:
            selectedSlot.professionalProfile.coverageComuna ??
            selectedSlot.professionalProfile.user.cleaningOnboarding?.baseCommune
        },
        clientCommune
      );
      if (!slotTaskerCanServe) {
        return NextResponse.json({ error: "El tasker seleccionado no atiende esa comuna" }, { status: 400 });
      }

      baseRate = selectedSlot.professionalProfile.taskerServices[0]?.priceClp ?? baseRate;
      assignedProId = selectedSlot.professionalProfile.userId;
    } else if (input.autoAssign && !assignedProId) {
      const candidates = await prisma.availabilitySlot.findMany({
        where: {
          isAvailable: true,
          startsAt: { lte: input.startsAt },
          endsAt: { gte: new Date(input.startsAt.getTime() + input.hours * 60 * 60 * 1000) },
          OR: [{ serviceId: null }, { serviceId: input.serviceId }],
          professionalProfile: {
            isVerified: true,
            user: {
              OR: [{ role: UserRole.PRO }, { roleAssignments: { some: { role: { code: UserRole.PRO } } } }]
            },
            taskerServices: {
              some: {
                serviceId: input.serviceId,
                isActive: true
              }
            }
          }
        },
        orderBy: [{ startsAt: "asc" }],
        include: {
          professionalProfile: {
            select: {
              userId: true,
              coverageComuna: true,
              taskerServices: {
                where: {
                  serviceId: input.serviceId,
                  isActive: true
                },
                select: { id: true, priceClp: true }
              },
              user: {
                select: {
                  cleaningOnboarding: {
                    select: {
                      serviceCommunes: true,
                      baseCommune: true
                    }
                  }
                }
              }
            }
          }
        },
        take: 80
      });

      const candidate = candidates.find((slot) =>
        slot.professionalProfile.taskerServices.length > 0 &&
        taskerServesCommune(
          {
            serviceCommunes: slot.professionalProfile.user.cleaningOnboarding?.serviceCommunes,
            coverageComuna: slot.professionalProfile.coverageComuna ?? slot.professionalProfile.user.cleaningOnboarding?.baseCommune
          },
          clientCommune
        )
      );

      assignedProId = candidate?.professionalProfile.userId ?? null;
      selectedSlotId = candidate?.id ?? null;
      baseRate = candidate?.professionalProfile.taskerServices[0]?.priceClp ?? baseRate;
    }

    if (assignedProId) {
      const pro = await prisma.user.findUnique({
        where: { id: assignedProId },
        select: {
          id: true,
          role: true,
          roleAssignments: {
            select: {
              role: {
                select: {
                  code: true
                }
              }
            }
          },
          professionalProfile: {
            select: {
              coverageComuna: true,
              taskerServices: {
                where: {
                  serviceId: input.serviceId,
                  isActive: true
                },
                select: { id: true, priceClp: true }
              }
            }
          },
          cleaningOnboarding: {
            select: {
              serviceCommunes: true,
              baseCommune: true
            }
          }
        }
      });
      if (!pro || !hasAssignedRole(pro, UserRole.PRO)) {
        return NextResponse.json({ error: "Profesional no válido" }, { status: 400 });
      }
      if (!pro.professionalProfile) {
        return NextResponse.json({ error: "El tasker seleccionado no tiene perfil activo" }, { status: 400 });
      }
      if (pro.professionalProfile && pro.professionalProfile.taskerServices.length === 0) {
        await syncTaskerMarketplaceServicesFromOnboarding(assignedProId);
        const syncedProService = await prisma.taskerService.findFirst({
          where: {
            professionalProfile: { userId: assignedProId },
            serviceId: input.serviceId,
            isActive: true
          },
          select: { id: true, priceClp: true }
        });
        if (!syncedProService) {
          return NextResponse.json({ error: "El tasker seleccionado no ofrece este servicio" }, { status: 400 });
        }
        pro.professionalProfile.taskerServices = [syncedProService];
      }

      baseRate = pro.professionalProfile.taskerServices[0]?.priceClp ?? baseRate;

      const taskerCanServe = taskerServesCommune(
        {
          serviceCommunes: pro.cleaningOnboarding?.serviceCommunes,
          coverageComuna: pro.professionalProfile?.coverageComuna ?? pro.cleaningOnboarding?.baseCommune
        },
        clientCommune
      );
      if (!taskerCanServe) {
        return NextResponse.json({ error: "El tasker seleccionado no atiende esa comuna" }, { status: 400 });
      }
    }

    const price = calculateMarketplacePrice({
      hourlyRateClp: baseRate,
      hours: input.hours,
      materials: Boolean(input.extras?.materials),
      urgency: Boolean(input.extras?.urgency),
      travelFeeClp: input.extras?.travelFeeClp ?? 0,
      materialFeeDefaultClp: service.category.materialFeeDefaultClp,
      urgencyFeeClp: service.category.urgencyFeeClp,
      platformFeePct
    });

    const address = await prisma.address.create({
      data: {
        userId: customer.id,
        street: input.address.street,
        city: input.address.city,
        postalCode: input.address.postalCode,
        region: input.address.region,
        country: "CL"
      }
    });

    const booking = await prisma.$transaction(async (tx) => {
      if (selectedSlotId) {
        await reserveRequestedWindow(tx, {
          slotId: selectedSlotId,
          serviceId: input.serviceId,
          startsAt: input.startsAt,
          endsAt: requestedEndsAt
        });
      }

      return tx.booking.create({
        data: {
          customerId: customer.id,
          proId: assignedProId,
          bookedSlotId: selectedSlotId,
          serviceId: input.serviceId,
          addressId: address.id,
          status: assignedProId ? "ASSIGNED" : "CREATED",
          scheduledAt: input.startsAt,
          addressLine1: input.address.street,
          comuna: clientCommune,
          region: input.address.region ?? "N/A",
          city: input.address.city,
          postalCode: input.address.postalCode,
          notes: input.details,
          hours: input.hours,
          slotMinutes: requestedSlotMinutes,
          autoAssign: input.autoAssign,
          hourlyPriceClp: price.hourlyRateClp,
          subtotalClp: price.subtotalClp,
          extrasTotalClp: price.extrasTotalClp,
          platformFeeClp: price.platformFeeClp,
          totalPriceClp: price.totalClp,
          paymentStatus: "PENDING",
          extras: {
            create: price.extras.map((item) => ({
              code: item.code,
              name: item.name,
              priceClp: item.priceClp,
              quantity: 1
            }))
          },
          payment: {
            create: {
              provider: "STRIPE",
              amountClp: price.totalClp,
              platformFeeClp: price.platformFeeClp,
              status: "PENDING"
            }
          }
        },
        include: {
          service: { select: { id: true, name: true } },
          customer: { select: { id: true, fullName: true, email: true } },
          pro: { select: { id: true, fullName: true } },
          extras: true,
          payment: true
        }
      });
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear la reserva marketplace",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
