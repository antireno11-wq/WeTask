import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.service.upsert({
    where: { slug: "limpieza-hogar" },
    update: {},
    create: {
      slug: "limpieza-hogar",
      name: "Limpieza hogar",
      description: "Servicio de limpieza para departamento o casa.",
      basePriceClp: 25000,
      durationMin: 180
    }
  });

  await prisma.user.upsert({
    where: { email: "cliente-demo@wetask.cl" },
    update: {},
    create: {
      email: "cliente-demo@wetask.cl",
      fullName: "Cliente Demo",
      role: "CUSTOMER"
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
