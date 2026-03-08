import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertCategory(data) {
  return prisma.category.upsert({
    where: { slug: data.slug },
    update: data,
    create: data
  });
}

async function upsertService(data) {
  return prisma.service.upsert({
    where: { slug: data.slug },
    update: data,
    create: data
  });
}

async function main() {
  const roleCustomer = await prisma.role.upsert({
    where: { code: "CUSTOMER" },
    update: { label: "Cliente" },
    create: { code: "CUSTOMER", label: "Cliente" }
  });
  const rolePro = await prisma.role.upsert({
    where: { code: "PRO" },
    update: { label: "Tasker" },
    create: { code: "PRO", label: "Tasker" }
  });
  const roleAdmin = await prisma.role.upsert({
    where: { code: "ADMIN" },
    update: { label: "Admin" },
    create: { code: "ADMIN", label: "Admin" }
  });

  const limpieza = await upsertCategory({
    slug: "limpieza",
    name: "Limpieza",
    description: "Limpieza de casas y departamentos en Santiago",
    minHours: 2,
    slotMinutes: 60,
    basePlatformFeePct: 12,
    urgencyFeeClp: 8000,
    materialFeeDefaultClp: 5000,
    isActive: true
  });

  const maestro = await upsertCategory({
    slug: "maestro-polifuncional",
    name: "Maestro (polifuncional)",
    description: "Reparaciones y mejoras del hogar",
    minHours: 1,
    slotMinutes: 60,
    basePlatformFeePct: 14,
    urgencyFeeClp: 10000,
    materialFeeDefaultClp: 0,
    isActive: true
  });

  const electricidad = await upsertCategory({
    slug: "electricidad",
    name: "Electricidad",
    description: "Instalacion y reparacion electrica",
    minHours: 1,
    slotMinutes: 60,
    basePlatformFeePct: 15,
    urgencyFeeClp: 12000,
    materialFeeDefaultClp: 0,
    isActive: true
  });

  const clasesColegio = await upsertCategory({
    slug: "clases-colegio",
    name: "Clases de colegio",
    description: "Refuerzo escolar",
    minHours: 1,
    slotMinutes: 60,
    basePlatformFeePct: 10,
    urgencyFeeClp: 0,
    materialFeeDefaultClp: 0,
    isActive: true
  });

  const clasesMusica = await upsertCategory({
    slug: "clases-musica",
    name: "Clases de musica",
    description: "Guitarra, piano y teoria",
    minHours: 1,
    slotMinutes: 60,
    basePlatformFeePct: 10,
    urgencyFeeClp: 0,
    materialFeeDefaultClp: 0,
    isActive: true
  });

  const jardineria = await upsertCategory({
    slug: "jardineria",
    name: "Jardineria",
    description: "Mantencion de jardines, poda y riego",
    minHours: 1,
    slotMinutes: 60,
    basePlatformFeePct: 12,
    urgencyFeeClp: 8000,
    materialFeeDefaultClp: 0,
    isActive: true
  });

  const babySitter = await upsertCategory({
    slug: "baby-sitter",
    name: "Baby sitter",
    description: "Cuidado infantil por bloques de tiempo",
    minHours: 4,
    slotMinutes: 60,
    basePlatformFeePct: 12,
    urgencyFeeClp: 10000,
    materialFeeDefaultClp: 0,
    isActive: true
  });

  const peluqueria = await upsertCategory({
    slug: "peluqueria",
    name: "Peluqueria",
    description: "Corte y peinado a domicilio",
    minHours: 1,
    slotMinutes: 60,
    basePlatformFeePct: 12,
    urgencyFeeClp: 6000,
    materialFeeDefaultClp: 0,
    isActive: true
  });

  const manicure = await upsertCategory({
    slug: "manicure",
    name: "Manicure",
    description: "Manicure clasica y esmaltado",
    minHours: 1,
    slotMinutes: 60,
    basePlatformFeePct: 12,
    urgencyFeeClp: 4000,
    materialFeeDefaultClp: 0,
    isActive: true
  });

  const veterinario = await upsertCategory({
    slug: "veterinario",
    name: "Veterinario",
    description: "Control y atencion veterinaria",
    minHours: 1,
    slotMinutes: 60,
    basePlatformFeePct: 12,
    urgencyFeeClp: 12000,
    materialFeeDefaultClp: 0,
    isActive: true
  });

  const paseadoresPerro = await upsertCategory({
    slug: "paseadores-de-perro",
    name: "Paseadores de perro",
    description: "Paseos diarios para mascotas",
    minHours: 1,
    slotMinutes: 60,
    basePlatformFeePct: 10,
    urgencyFeeClp: 0,
    materialFeeDefaultClp: 0,
    isActive: true
  });

  const cuidadoresAnimales = await upsertCategory({
    slug: "cuidadores-de-animales",
    name: "Cuidadores de animales",
    description: "Visitas y cuidado de mascotas",
    minHours: 1,
    slotMinutes: 60,
    basePlatformFeePct: 12,
    urgencyFeeClp: 0,
    materialFeeDefaultClp: 0,
    isActive: true
  });

  await upsertService({
    slug: "limpieza-hogar",
    name: "Limpieza hogar",
    description: "Aseo general por hora",
    basePriceClp: 22000,
    durationMin: 60,
    categoryId: limpieza.id,
    isActive: true
  });

  await upsertService({
    slug: "maestro-hogar",
    name: "Maestro a domicilio",
    description: "Armado y reparaciones del hogar",
    basePriceClp: 27000,
    durationMin: 60,
    categoryId: maestro.id,
    isActive: true
  });

  await upsertService({
    slug: "electricista-domicilio",
    name: "Electricista a domicilio",
    description: "Diagnostico y reparacion electrica",
    basePriceClp: 30000,
    durationMin: 60,
    categoryId: electricidad.id,
    isActive: true
  });

  await upsertService({
    slug: "clases-matematicas",
    name: "Clases de matematicas",
    description: "Refuerzo escolar basica y media",
    basePriceClp: 18000,
    durationMin: 60,
    categoryId: clasesColegio.id,
    isActive: true
  });

  await upsertService({
    slug: "clases-guitarra",
    name: "Clases de guitarra",
    description: "Iniciacion e intermedio",
    basePriceClp: 20000,
    durationMin: 60,
    categoryId: clasesMusica.id,
    isActive: true
  });

  await upsertService({
    slug: "jardineria-mantencion",
    name: "Mantencion de jardin",
    description: "Poda, corte de pasto y limpieza",
    basePriceClp: 24000,
    durationMin: 60,
    categoryId: jardineria.id,
    isActive: true
  });

  await upsertService({
    slug: "baby-sitter-4h",
    name: "Baby sitter bloque 4h",
    description: "Cuidado infantil por bloque de 4 horas",
    basePriceClp: 32000,
    durationMin: 240,
    categoryId: babySitter.id,
    isActive: true
  });

  await upsertService({
    slug: "peluqueria-corte",
    name: "Corte y peinado",
    description: "Corte y brushing a domicilio",
    basePriceClp: 18000,
    durationMin: 60,
    categoryId: peluqueria.id,
    isActive: true
  });

  await upsertService({
    slug: "manicure-clasica",
    name: "Manicure clasica",
    description: "Limpieza y esmaltado",
    basePriceClp: 16000,
    durationMin: 60,
    categoryId: manicure.id,
    isActive: true
  });

  await upsertService({
    slug: "veterinario-control",
    name: "Control veterinario",
    description: "Chequeo general de mascota",
    basePriceClp: 28000,
    durationMin: 60,
    categoryId: veterinario.id,
    isActive: true
  });

  await upsertService({
    slug: "paseo-perro-60",
    name: "Paseo de perro 60 minutos",
    description: "Paseo individual o grupal",
    basePriceClp: 12000,
    durationMin: 60,
    categoryId: paseadoresPerro.id,
    isActive: true
  });

  await upsertService({
    slug: "cuidado-animales-visita",
    name: "Cuidado de animales por visita",
    description: "Alimentacion y cuidado basico",
    basePriceClp: 15000,
    durationMin: 60,
    categoryId: cuidadoresAnimales.id,
    isActive: true
  });

  const customer = await prisma.user.upsert({
    where: { email: "cliente-demo@wetask.cl" },
    update: { fullName: "Camila Soto", role: "CUSTOMER", emailVerifiedAt: new Date(), termsAcceptedAt: new Date() },
    create: {
      email: "cliente-demo@wetask.cl",
      fullName: "Camila Soto",
      role: "CUSTOMER",
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date()
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin-demo@wetask.cl" },
    update: { fullName: "Admin Demo", role: "ADMIN", emailVerifiedAt: new Date(), termsAcceptedAt: new Date() },
    create: {
      email: "admin-demo@wetask.cl",
      fullName: "Admin Demo",
      role: "ADMIN",
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date()
    }
  });

  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: customer.id, roleId: roleCustomer.id } },
    update: {},
    create: { userId: customer.id, roleId: roleCustomer.id }
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roleAdmin.id } },
    update: {},
    create: { userId: admin.id, roleId: roleAdmin.id }
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: rolePro.id } },
    update: {},
    create: { userId: admin.id, roleId: rolePro.id }
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
