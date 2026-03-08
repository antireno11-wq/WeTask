import { PaymentStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DemoPro = {
  email: string;
  fullName: string;
  city: string;
  postal: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  rate: number;
  rating: number;
  count: number;
  serviceSlugs: string[];
};

async function ensureRoleAssignment(userId: string, code: UserRole, label: string) {
  const role = await prisma.role.upsert({
    where: { code },
    update: { label },
    create: { code, label }
  });

  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id }
  });
}

export async function ensureMarketplaceDemoData() {
  const legacyCategory = await prisma.category.findUnique({ where: { slug: "manitas" } });
  if (legacyCategory) {
    await prisma.category.update({
      where: { id: legacyCategory.id },
      data: { isActive: false }
    });
  }

  const legacyService = await prisma.service.findUnique({ where: { slug: "manitas-general" } });
  if (legacyService) {
    await prisma.service.update({
      where: { id: legacyService.id },
      data: { isActive: false }
    });
  }

  const categories = {
    limpieza: await prisma.category.upsert({
      where: { slug: "limpieza" },
      update: {
        name: "Limpieza",
        description: "Limpieza de casas y departamentos en Santiago",
        minHours: 2,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 8000,
        materialFeeDefaultClp: 5000,
        isActive: true
      },
      create: {
        slug: "limpieza",
        name: "Limpieza",
        description: "Limpieza de casas y departamentos en Santiago",
        minHours: 2,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 8000,
        materialFeeDefaultClp: 5000,
        isActive: true
      }
    }),
    maestro: await prisma.category.upsert({
      where: { slug: "maestro-polifuncional" },
      update: {
        name: "Maestro (polifuncional)",
        description: "Reparaciones, armado y mejoras del hogar",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 14,
        urgencyFeeClp: 10000,
        materialFeeDefaultClp: 0,
        isActive: true
      },
      create: {
        slug: "maestro-polifuncional",
        name: "Maestro (polifuncional)",
        description: "Reparaciones, armado y mejoras del hogar",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 14,
        urgencyFeeClp: 10000,
        materialFeeDefaultClp: 0,
        isActive: true
      }
    }),
    electricidad: await prisma.category.upsert({
      where: { slug: "electricidad" },
      update: {
        name: "Electricidad",
        description: "Instalacion y reparacion electrica",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 15,
        urgencyFeeClp: 12000,
        materialFeeDefaultClp: 0,
        isActive: true
      },
      create: {
        slug: "electricidad",
        name: "Electricidad",
        description: "Instalacion y reparacion electrica",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 15,
        urgencyFeeClp: 12000,
        materialFeeDefaultClp: 0,
        isActive: true
      }
    }),
    clasesEscolares: await prisma.category.upsert({
      where: { slug: "clases-colegio" },
      update: {
        name: "Clases de colegio",
        description: "Refuerzo escolar en matematicas, lenguaje y ciencias",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 10,
        urgencyFeeClp: 0,
        materialFeeDefaultClp: 0,
        isActive: true
      },
      create: {
        slug: "clases-colegio",
        name: "Clases de colegio",
        description: "Refuerzo escolar en matematicas, lenguaje y ciencias",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 10,
        urgencyFeeClp: 0,
        materialFeeDefaultClp: 0,
        isActive: true
      }
    }),
    clasesMusica: await prisma.category.upsert({
      where: { slug: "clases-musica" },
      update: {
        name: "Clases de musica",
        description: "Clases particulares de guitarra, piano y teoria",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 10,
        urgencyFeeClp: 0,
        materialFeeDefaultClp: 0,
        isActive: true
      },
      create: {
        slug: "clases-musica",
        name: "Clases de musica",
        description: "Clases particulares de guitarra, piano y teoria",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 10,
        urgencyFeeClp: 0,
        materialFeeDefaultClp: 0,
        isActive: true
      }
    }),
    jardineria: await prisma.category.upsert({
      where: { slug: "jardineria" },
      update: {
        name: "Jardineria",
        description: "Mantencion de jardines, poda y riego",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 8000,
        materialFeeDefaultClp: 0,
        isActive: true
      },
      create: {
        slug: "jardineria",
        name: "Jardineria",
        description: "Mantencion de jardines, poda y riego",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 8000,
        materialFeeDefaultClp: 0,
        isActive: true
      }
    }),
    babySitter: await prisma.category.upsert({
      where: { slug: "baby-sitter" },
      update: {
        name: "Baby sitter",
        description: "Cuidado infantil por bloques de tiempo",
        minHours: 4,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 10000,
        materialFeeDefaultClp: 0,
        isActive: true
      },
      create: {
        slug: "baby-sitter",
        name: "Baby sitter",
        description: "Cuidado infantil por bloques de tiempo",
        minHours: 4,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 10000,
        materialFeeDefaultClp: 0,
        isActive: true
      }
    }),
    peluqueria: await prisma.category.upsert({
      where: { slug: "peluqueria" },
      update: {
        name: "Peluqueria",
        description: "Corte, brushing y styling a domicilio",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 6000,
        materialFeeDefaultClp: 0,
        isActive: true
      },
      create: {
        slug: "peluqueria",
        name: "Peluqueria",
        description: "Corte, brushing y styling a domicilio",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 6000,
        materialFeeDefaultClp: 0,
        isActive: true
      }
    }),
    manicure: await prisma.category.upsert({
      where: { slug: "manicure" },
      update: {
        name: "Manicure",
        description: "Manicure clasica, gel y cuidados de manos",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 4000,
        materialFeeDefaultClp: 0,
        isActive: true
      },
      create: {
        slug: "manicure",
        name: "Manicure",
        description: "Manicure clasica, gel y cuidados de manos",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 4000,
        materialFeeDefaultClp: 0,
        isActive: true
      }
    }),
    veterinario: await prisma.category.upsert({
      where: { slug: "veterinario" },
      update: {
        name: "Veterinario",
        description: "Atencion veterinaria preventiva y de control",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 12000,
        materialFeeDefaultClp: 0,
        isActive: true
      },
      create: {
        slug: "veterinario",
        name: "Veterinario",
        description: "Atencion veterinaria preventiva y de control",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 12000,
        materialFeeDefaultClp: 0,
        isActive: true
      }
    }),
    paseadoresPerro: await prisma.category.upsert({
      where: { slug: "paseadores-de-perro" },
      update: {
        name: "Paseadores de perro",
        description: "Paseos diarios de 30 o 60 minutos",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 10,
        urgencyFeeClp: 0,
        materialFeeDefaultClp: 0,
        isActive: true
      },
      create: {
        slug: "paseadores-de-perro",
        name: "Paseadores de perro",
        description: "Paseos diarios de 30 o 60 minutos",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 10,
        urgencyFeeClp: 0,
        materialFeeDefaultClp: 0,
        isActive: true
      }
    }),
    cuidadoresAnimales: await prisma.category.upsert({
      where: { slug: "cuidadores-de-animales" },
      update: {
        name: "Cuidadores de animales",
        description: "Visitas o cuidado nocturno para mascotas",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 0,
        materialFeeDefaultClp: 0,
        isActive: true
      },
      create: {
        slug: "cuidadores-de-animales",
        name: "Cuidadores de animales",
        description: "Visitas o cuidado nocturno para mascotas",
        minHours: 1,
        slotMinutes: 60,
        basePlatformFeePct: 12,
        urgencyFeeClp: 0,
        materialFeeDefaultClp: 0,
        isActive: true
      }
    })
  };

  const serviceSpecs = [
    {
      slug: "limpieza-hogar",
      name: "Limpieza hogar",
      description: "Aseo general por hora para departamento o casa",
      basePriceClp: 22000,
      categoryId: categories.limpieza.id
    },
    {
      slug: "limpieza-profunda",
      name: "Limpieza profunda",
      description: "Limpieza completa de cocina, baños y superficies",
      basePriceClp: 26000,
      categoryId: categories.limpieza.id
    },
    {
      slug: "maestro-hogar",
      name: "Maestro a domicilio",
      description: "Armado de muebles, sellados, anclajes y reparaciones",
      basePriceClp: 27000,
      categoryId: categories.maestro.id
    },
    {
      slug: "electricista-domicilio",
      name: "Electricista a domicilio",
      description: "Diagnostico electrico, enchufes, luminarias y tablero",
      basePriceClp: 30000,
      categoryId: categories.electricidad.id
    },
    {
      slug: "clases-matematicas",
      name: "Clases de matematicas",
      description: "Refuerzo para basica y media",
      basePriceClp: 18000,
      categoryId: categories.clasesEscolares.id
    },
    {
      slug: "clases-lenguaje",
      name: "Clases de lenguaje",
      description: "Comprension lectora y preparacion PAES",
      basePriceClp: 17000,
      categoryId: categories.clasesEscolares.id
    },
    {
      slug: "clases-guitarra",
      name: "Clases de guitarra",
      description: "Iniciacion, acordes y repertorio",
      basePriceClp: 20000,
      categoryId: categories.clasesMusica.id
    },
    {
      slug: "clases-piano",
      name: "Clases de piano",
      description: "Tecnica, lectura y repertorio",
      basePriceClp: 23000,
      categoryId: categories.clasesMusica.id
    },
    {
      slug: "jardineria-mantencion",
      name: "Mantencion de jardin",
      description: "Poda, corte de pasto y limpieza de patio",
      basePriceClp: 24000,
      categoryId: categories.jardineria.id
    },
    {
      slug: "baby-sitter-4h",
      name: "Baby sitter bloque 4h",
      description: "Cuidado infantil por bloque de cuatro horas",
      basePriceClp: 32000,
      categoryId: categories.babySitter.id
    },
    {
      slug: "peluqueria-corte",
      name: "Corte y peinado",
      description: "Corte de cabello y brushing a domicilio",
      basePriceClp: 18000,
      categoryId: categories.peluqueria.id
    },
    {
      slug: "manicure-clasica",
      name: "Manicure clasica",
      description: "Limpieza y esmaltado tradicional",
      basePriceClp: 16000,
      categoryId: categories.manicure.id
    },
    {
      slug: "veterinario-control",
      name: "Control veterinario",
      description: "Chequeo general de mascota",
      basePriceClp: 28000,
      categoryId: categories.veterinario.id
    },
    {
      slug: "paseo-perro-60",
      name: "Paseo de perro 60 minutos",
      description: "Paseo individual o grupal por 60 minutos",
      basePriceClp: 12000,
      categoryId: categories.paseadoresPerro.id
    },
    {
      slug: "cuidado-animales-visita",
      name: "Cuidado de animales por visita",
      description: "Alimentacion y cuidados basicos por visita",
      basePriceClp: 15000,
      categoryId: categories.cuidadoresAnimales.id
    }
  ];

  for (const spec of serviceSpecs) {
    await prisma.service.upsert({
      where: { slug: spec.slug },
      update: {
        name: spec.name,
        description: spec.description,
        basePriceClp: spec.basePriceClp,
        durationMin: 60,
        categoryId: spec.categoryId,
        isActive: true
      },
      create: {
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        basePriceClp: spec.basePriceClp,
        durationMin: 60,
        categoryId: spec.categoryId,
        isActive: true
      }
    });
  }

  const serviceBySlug = new Map((await prisma.service.findMany({ where: { isActive: true } })).map((s) => [s.slug, s]));

  const pros: DemoPro[] = [
    {
      email: "pro.ana@wetask.cl",
      fullName: "Ana Gonzalez",
      city: "Santiago",
      postal: "8320000",
      latitude: -33.4477,
      longitude: -70.6506,
      radiusKm: 7,
      rate: 22000,
      rating: 4.9,
      count: 184,
      serviceSlugs: ["limpieza-hogar", "limpieza-profunda", "manicure-clasica"]
    },
    {
      email: "pro.carlos@wetask.cl",
      fullName: "Carlos Muñoz",
      city: "Santiago",
      postal: "7510000",
      latitude: -33.4263,
      longitude: -70.6105,
      radiusKm: 9,
      rate: 27000,
      rating: 4.8,
      count: 129,
      serviceSlugs: ["maestro-hogar", "electricista-domicilio", "jardineria-mantencion"]
    },
    {
      email: "pro.javier@wetask.cl",
      fullName: "Javier Rojas",
      city: "Santiago",
      postal: "7750000",
      latitude: -33.4188,
      longitude: -70.5672,
      radiusKm: 10,
      rate: 30000,
      rating: 4.7,
      count: 97,
      serviceSlugs: ["electricista-domicilio", "veterinario-control"]
    },
    {
      email: "pro.paula@wetask.cl",
      fullName: "Paula Contreras",
      city: "Santiago",
      postal: "7500000",
      latitude: -33.4569,
      longitude: -70.5975,
      radiusKm: 8,
      rate: 24000,
      rating: 4.9,
      count: 210,
      serviceSlugs: ["limpieza-hogar", "maestro-hogar", "peluqueria-corte"]
    },
    {
      email: "pro.mario@wetask.cl",
      fullName: "Mario Paredes",
      city: "Santiago",
      postal: "8330000",
      latitude: -33.4534,
      longitude: -70.6662,
      radiusKm: 6,
      rate: 18000,
      rating: 4.8,
      count: 75,
      serviceSlugs: ["clases-matematicas", "clases-lenguaje", "paseo-perro-60"]
    },
    {
      email: "pro.camila@wetask.cl",
      fullName: "Camila Vera",
      city: "Santiago",
      postal: "7510010",
      latitude: -33.4202,
      longitude: -70.6079,
      radiusKm: 6,
      rate: 21000,
      rating: 4.9,
      count: 143,
      serviceSlugs: ["clases-guitarra", "clases-piano", "baby-sitter-4h", "cuidado-animales-visita"]
    }
  ];

  for (const [index, pro] of pros.entries()) {
    const user = await prisma.user.upsert({
      where: { email: pro.email },
      update: { fullName: pro.fullName, role: UserRole.PRO, emailVerifiedAt: new Date(), termsAcceptedAt: new Date() },
      create: { email: pro.email, fullName: pro.fullName, role: UserRole.PRO, emailVerifiedAt: new Date(), termsAcceptedAt: new Date() }
    });
    await ensureRoleAssignment(user.id, UserRole.PRO, "Tasker");

    const profile = await prisma.professionalProfile.upsert({
      where: { userId: user.id },
      update: {
        isVerified: true,
        coverageCity: pro.city,
        coveragePostal: pro.postal,
        coverageLatitude: pro.latitude,
        coverageLongitude: pro.longitude,
        serviceRadiusKm: pro.radiusKm,
        hourlyRateFromClp: pro.rate,
        ratingAvg: pro.rating,
        ratingsCount: pro.count,
        bio: `${pro.fullName} presta servicios en Santiago y comunas cercanas.`
      },
      create: {
        userId: user.id,
        isVerified: true,
        coverageCity: pro.city,
        coveragePostal: pro.postal,
        coverageLatitude: pro.latitude,
        coverageLongitude: pro.longitude,
        serviceRadiusKm: pro.radiusKm,
        hourlyRateFromClp: pro.rate,
        ratingAvg: pro.rating,
        ratingsCount: pro.count,
        bio: `${pro.fullName} presta servicios en Santiago y comunas cercanas.`
      }
    });

    const slotCount = await prisma.availabilitySlot.count({ where: { professionalProfileId: profile.id } });

    if (slotCount === 0) {
      const slotData = [];
      for (let day = 1; day <= 7; day += 1) {
        for (let b = 0; b < 3; b += 1) {
          const startsAt = new Date();
          startsAt.setDate(startsAt.getDate() + day + index % 2);
          startsAt.setHours(9 + b * 3, 0, 0, 0);
          const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

          const serviceSlug = pro.serviceSlugs[b % pro.serviceSlugs.length];
          const service = serviceBySlug.get(serviceSlug);

          slotData.push({
            professionalProfileId: profile.id,
            serviceId: service?.id,
            startsAt,
            endsAt,
            isAvailable: true
          });
        }
      }

      await prisma.availabilitySlot.createMany({ data: slotData });
    }

    for (const serviceSlug of pro.serviceSlugs) {
      const service = serviceBySlug.get(serviceSlug);
      if (!service?.categoryId) continue;

      await prisma.taskerService.upsert({
        where: {
          professionalProfileId_serviceId: {
            professionalProfileId: profile.id,
            serviceId: service.id
          }
        },
        update: {
          categoryId: service.categoryId,
          priceClp: pro.rate,
          minBooking: 1,
          isActive: true
        },
        create: {
          professionalProfileId: profile.id,
          categoryId: service.categoryId,
          serviceId: service.id,
          priceClp: pro.rate,
          minBooking: 1,
          isActive: true
        }
      });
    }
  }

  const customer = await prisma.user.upsert({
    where: { email: "cliente-demo@wetask.cl" },
    update: { fullName: "Camila Soto", role: UserRole.CUSTOMER, phone: "+56981234567", emailVerifiedAt: new Date(), termsAcceptedAt: new Date() },
    create: {
      email: "cliente-demo@wetask.cl",
      fullName: "Camila Soto",
      role: UserRole.CUSTOMER,
      phone: "+56981234567",
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date()
    }
  });
  await ensureRoleAssignment(customer.id, UserRole.CUSTOMER, "Cliente");

  const admin = await prisma.user.upsert({
    where: { email: "admin-demo@wetask.cl" },
    update: { fullName: "Admin Demo", role: UserRole.ADMIN, emailVerifiedAt: new Date(), termsAcceptedAt: new Date() },
    create: {
      email: "admin-demo@wetask.cl",
      fullName: "Admin Demo",
      role: UserRole.ADMIN,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date()
    }
  });
  await ensureRoleAssignment(admin.id, UserRole.ADMIN, "Admin");

  const customerAddress = await prisma.address.upsert({
    where: { id: "demo-customer-address" },
    update: {
      userId: customer.id,
      label: "Casa",
      street: "Av. Providencia 1550",
      city: "Santiago",
      postalCode: "7500000",
      region: "Metropolitana",
      country: "CL"
    },
    create: {
      id: "demo-customer-address",
      userId: customer.id,
      label: "Casa",
      street: "Av. Providencia 1550",
      city: "Santiago",
      postalCode: "7500000",
      region: "Metropolitana",
      country: "CL"
    }
  });

  const demoBookings = [
    {
      marker: "demo-booking-1",
      serviceSlug: "limpieza-hogar",
      proEmail: "pro.ana@wetask.cl",
      status: "CONFIRMED",
      paymentStatus: PaymentStatus.PAID,
      days: 1,
      hours: 2,
      total: 52000
    },
    {
      marker: "demo-booking-2",
      serviceSlug: "maestro-hogar",
      proEmail: "pro.carlos@wetask.cl",
      status: "IN_PROGRESS",
      paymentStatus: PaymentStatus.PAID,
      days: 2,
      hours: 3,
      total: 92000
    },
    {
      marker: "demo-booking-3",
      serviceSlug: "clases-piano",
      proEmail: "pro.camila@wetask.cl",
      status: "COMPLETED",
      paymentStatus: PaymentStatus.PAID,
      days: -2,
      hours: 1,
      total: 23000
    }
  ] as const;

  for (const spec of demoBookings) {
    const exists = await prisma.booking.findFirst({ where: { notes: spec.marker } });
    if (exists) continue;

    const service = serviceBySlug.get(spec.serviceSlug);
    const pro = await prisma.user.findUnique({ where: { email: spec.proEmail } });
    if (!service || !pro) continue;

    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + spec.days);
    scheduledAt.setHours(11, 0, 0, 0);

    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        proId: pro.id,
        serviceId: service.id,
        addressId: customerAddress.id,
        status: spec.status,
        scheduledAt,
        addressLine1: customerAddress.street,
        comuna: "Providencia",
        region: "Metropolitana",
        city: "Santiago",
        postalCode: customerAddress.postalCode,
        notes: spec.marker,
        hours: spec.hours,
        slotMinutes: 60,
        autoAssign: false,
        hourlyPriceClp: Math.round(spec.total / spec.hours),
        subtotalClp: spec.total,
        extrasTotalClp: 0,
        platformFeeClp: Math.round(spec.total * 0.12),
        totalPriceClp: spec.total,
        paymentStatus: spec.paymentStatus,
        payment: {
          create: {
            provider: "STRIPE",
            amountClp: spec.total,
            platformFeeClp: Math.round(spec.total * 0.12),
            status: spec.paymentStatus,
            paidAt: new Date()
          }
        }
      }
    });

    if (spec.marker === "demo-booking-1") {
      await prisma.message.createMany({
        data: [
          {
            bookingId: booking.id,
            senderId: customer.id,
            body: "Hola Ana, ¿puedes llegar 10 minutos antes?"
          },
          {
            bookingId: booking.id,
            senderId: pro.id,
            body: "Si, llego a las 10:50 sin problema."
          }
        ]
      });
    }
  }

  return { customerId: customer.id };
}
