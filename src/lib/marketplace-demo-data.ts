import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function ensureMarketplaceDemoData() {
  const limpieza = await prisma.category.upsert({
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
  });

  const manitas = await prisma.category.upsert({
    where: { slug: "manitas" },
    update: {
      name: "Manitas",
      description: "Armado, reparaciones y mantenciones",
      minHours: 1,
      slotMinutes: 60,
      basePlatformFeePct: 14,
      urgencyFeeClp: 10000,
      materialFeeDefaultClp: 0,
      isActive: true
    },
    create: {
      slug: "manitas",
      name: "Manitas",
      description: "Armado, reparaciones y mantenciones",
      minHours: 1,
      slotMinutes: 60,
      basePlatformFeePct: 14,
      urgencyFeeClp: 10000,
      materialFeeDefaultClp: 0,
      isActive: true
    }
  });

  const electricidad = await prisma.category.upsert({
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
  });

  await prisma.service.upsert({
    where: { slug: "limpieza-hogar" },
    update: {
      name: "Limpieza hogar",
      description: "Aseo general de hogar por bloques de 1 hora",
      basePriceClp: 22000,
      durationMin: 60,
      categoryId: limpieza.id,
      isActive: true
    },
    create: {
      slug: "limpieza-hogar",
      name: "Limpieza hogar",
      description: "Aseo general de hogar por bloques de 1 hora",
      basePriceClp: 22000,
      durationMin: 60,
      categoryId: limpieza.id,
      isActive: true
    }
  });

  await prisma.service.upsert({
    where: { slug: "manitas-general" },
    update: {
      name: "Manitas general",
      description: "Armado de muebles, anclajes y reparaciones menores",
      basePriceClp: 26000,
      durationMin: 60,
      categoryId: manitas.id,
      isActive: true
    },
    create: {
      slug: "manitas-general",
      name: "Manitas general",
      description: "Armado de muebles, anclajes y reparaciones menores",
      basePriceClp: 26000,
      durationMin: 60,
      categoryId: manitas.id,
      isActive: true
    }
  });

  await prisma.service.upsert({
    where: { slug: "electricista-domicilio" },
    update: {
      name: "Electricista a domicilio",
      description: "Diagnostico electrico, enchufes, luminarias y tablero",
      basePriceClp: 30000,
      durationMin: 60,
      categoryId: electricidad.id,
      isActive: true
    },
    create: {
      slug: "electricista-domicilio",
      name: "Electricista a domicilio",
      description: "Diagnostico electrico, enchufes, luminarias y tablero",
      basePriceClp: 30000,
      durationMin: 60,
      categoryId: electricidad.id,
      isActive: true
    }
  });

  const pros = [
    { email: "pro.ana@wetask.cl", fullName: "Ana Gonzalez", city: "Santiago", postal: "8320000", rate: 22000, rating: 4.9, count: 184 },
    { email: "pro.carlos@wetask.cl", fullName: "Carlos Muñoz", city: "Santiago", postal: "7510000", rate: 26000, rating: 4.8, count: 129 },
    { email: "pro.javier@wetask.cl", fullName: "Javier Rojas", city: "Santiago", postal: "7750000", rate: 30000, rating: 4.7, count: 97 },
    { email: "pro.paula@wetask.cl", fullName: "Paula Contreras", city: "Santiago", postal: "7500000", rate: 24000, rating: 4.9, count: 210 }
  ];

  const limpiezaService = await prisma.service.findUnique({ where: { slug: "limpieza-hogar" } });

  for (const [index, pro] of pros.entries()) {
    const user = await prisma.user.upsert({
      where: { email: pro.email },
      update: { fullName: pro.fullName, role: UserRole.PRO },
      create: { email: pro.email, fullName: pro.fullName, role: UserRole.PRO }
    });

    const profile = await prisma.professionalProfile.upsert({
      where: { userId: user.id },
      update: {
        isVerified: true,
        coverageCity: pro.city,
        coveragePostal: pro.postal,
        hourlyRateFromClp: pro.rate,
        ratingAvg: pro.rating,
        ratingsCount: pro.count,
        bio: `${pro.fullName} presta servicios en Santiago Centro, Providencia, Ñuñoa y Las Condes.`
      },
      create: {
        userId: user.id,
        isVerified: true,
        coverageCity: pro.city,
        coveragePostal: pro.postal,
        hourlyRateFromClp: pro.rate,
        ratingAvg: pro.rating,
        ratingsCount: pro.count,
        bio: `${pro.fullName} presta servicios en Santiago Centro, Providencia, Ñuñoa y Las Condes.`
      }
    });

    const slotCount = await prisma.availabilitySlot.count({ where: { professionalProfileId: profile.id } });

    if (slotCount === 0) {
      const base = new Date();
      base.setDate(base.getDate() + 1 + index);
      base.setHours(9, 0, 0, 0);

      const blocks = [0, 3, 6].map((offset) => {
        const startsAt = new Date(base.getTime() + offset * 60 * 60 * 1000);
        const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
        return {
          professionalProfileId: profile.id,
          serviceId: limpiezaService?.id,
          startsAt,
          endsAt,
          isAvailable: true
        };
      });

      await prisma.availabilitySlot.createMany({ data: blocks });
    }
  }
}
