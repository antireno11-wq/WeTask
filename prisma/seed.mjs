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

  await prisma.user.upsert({
    where: { email: "cliente-demo@wetask.cl" },
    update: { fullName: "Camila Soto", role: "CUSTOMER" },
    create: {
      email: "cliente-demo@wetask.cl",
      fullName: "Camila Soto",
      role: "CUSTOMER"
    }
  });

  await prisma.user.upsert({
    where: { email: "admin-demo@wetask.cl" },
    update: { fullName: "Admin Demo", role: "ADMIN" },
    create: {
      email: "admin-demo@wetask.cl",
      fullName: "Admin Demo",
      role: "ADMIN"
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
