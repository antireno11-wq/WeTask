import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const limpieza = await prisma.category.upsert({
    where: { slug: "limpieza" },
    update: {
      minHours: 2,
      slotMinutes: 60,
      basePlatformFeePct: 12,
      urgencyFeeClp: 7000,
      materialFeeDefaultClp: 5000,
      isActive: true
    },
    create: {
      slug: "limpieza",
      name: "Limpieza",
      description: "Limpieza de hogar y oficinas",
      minHours: 2,
      slotMinutes: 60,
      basePlatformFeePct: 12,
      urgencyFeeClp: 7000,
      materialFeeDefaultClp: 5000,
      isActive: true
    }
  });

  const manitas = await prisma.category.upsert({
    where: { slug: "manitas" },
    update: {
      minHours: 1,
      slotMinutes: 60,
      basePlatformFeePct: 14,
      urgencyFeeClp: 9000,
      materialFeeDefaultClp: 0,
      isActive: true
    },
    create: {
      slug: "manitas",
      name: "Manitas",
      description: "Reparaciones y tareas de mantenimiento",
      minHours: 1,
      slotMinutes: 60,
      basePlatformFeePct: 14,
      urgencyFeeClp: 9000,
      materialFeeDefaultClp: 0,
      isActive: true
    }
  });

  const electricidad = await prisma.category.upsert({
    where: { slug: "electricidad" },
    update: {
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
      description: "Instalaciones y reparaciones electricas",
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
      categoryId: limpieza.id,
      basePriceClp: 25000,
      durationMin: 60,
      isActive: true
    },
    create: {
      slug: "limpieza-hogar",
      name: "Limpieza hogar",
      description: "Servicio de limpieza para departamento o casa",
      basePriceClp: 25000,
      durationMin: 60,
      categoryId: limpieza.id,
      isActive: true
    }
  });

  await prisma.service.upsert({
    where: { slug: "manitas-general" },
    update: {
      categoryId: manitas.id,
      basePriceClp: 28000,
      durationMin: 60,
      isActive: true
    },
    create: {
      slug: "manitas-general",
      name: "Manitas general",
      description: "Armado de muebles, ajustes y mantenciones",
      basePriceClp: 28000,
      durationMin: 60,
      categoryId: manitas.id,
      isActive: true
    }
  });

  await prisma.service.upsert({
    where: { slug: "electricista-domicilio" },
    update: {
      categoryId: electricidad.id,
      basePriceClp: 32000,
      durationMin: 60,
      isActive: true
    },
    create: {
      slug: "electricista-domicilio",
      name: "Electricista a domicilio",
      description: "Diagnostico y reparacion electrica",
      basePriceClp: 32000,
      durationMin: 60,
      categoryId: electricidad.id,
      isActive: true
    }
  });

  const customer = await prisma.user.upsert({
    where: { email: "cliente-demo@wetask.cl" },
    update: { fullName: "Cliente Demo", role: UserRole.CUSTOMER },
    create: {
      email: "cliente-demo@wetask.cl",
      fullName: "Cliente Demo",
      role: UserRole.CUSTOMER,
      phone: "+56900000001"
    }
  });

  const pro = await prisma.user.upsert({
    where: { email: "pro-demo@wetask.cl" },
    update: { fullName: "Pro Demo", role: UserRole.PRO },
    create: {
      email: "pro-demo@wetask.cl",
      fullName: "Pro Demo",
      role: UserRole.PRO,
      phone: "+56900000002"
    }
  });

  await prisma.user.upsert({
    where: { email: "admin-demo@wetask.cl" },
    update: { fullName: "Admin Demo", role: UserRole.ADMIN },
    create: {
      email: "admin-demo@wetask.cl",
      fullName: "Admin Demo",
      role: UserRole.ADMIN,
      phone: "+56900000003"
    }
  });

  const profile = await prisma.professionalProfile.upsert({
    where: { userId: pro.id },
    update: {
      isVerified: true,
      bio: "Especialista en servicios a domicilio",
      coverageCity: "Madrid",
      coveragePostal: "28001",
      hourlyRateFromClp: 28000
    },
    create: {
      userId: pro.id,
      isVerified: true,
      bio: "Especialista en servicios a domicilio",
      coverageCity: "Madrid",
      coveragePostal: "28001",
      hourlyRateFromClp: 28000
    }
  });

  const limpiezaService = await prisma.service.findUnique({ where: { slug: "limpieza-hogar" } });

  if (limpiezaService) {
    await prisma.availabilitySlot.deleteMany({
      where: {
        professionalProfileId: profile.id,
        serviceId: limpiezaService.id
      }
    });

    const slotStart = new Date();
    slotStart.setDate(slotStart.getDate() + 1);
    slotStart.setHours(10, 0, 0, 0);

    const slotEnd = new Date(slotStart.getTime() + 4 * 60 * 60 * 1000);

    await prisma.availabilitySlot.create({
      data: {
        professionalProfileId: profile.id,
        serviceId: limpiezaService.id,
        startsAt: slotStart,
        endsAt: slotEnd,
        isAvailable: true
      }
    });
  }

  await prisma.address.create({
    data: {
      userId: customer.id,
      label: "Casa",
      street: "Av. Providencia 1234",
      city: "Santiago",
      postalCode: "7500000",
      region: "Metropolitana",
      country: "CL"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
