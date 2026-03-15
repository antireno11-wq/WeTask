import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRequest } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const teamActionSchema = z.object({
  action: z.enum(["grant", "revoke"]),
  userId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional()
});

function formatRoleLabel(role: UserRole) {
  if (role === UserRole.ADMIN) return "Admin";
  if (role === UserRole.PRO) return "Tasker";
  return "Cliente";
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  const [admins, recentUsers] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      orderBy: [{ fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
        roleAssignments: {
          select: {
            role: {
              select: {
                code: true,
                label: true
              }
            }
          }
        }
      }
    }),
    prisma.user.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 18,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        professionalProfile: {
          select: {
            isVerified: true,
            verificationStatus: true
          }
        },
        cleaningOnboarding: {
          select: {
            status: true
          }
        }
      }
    })
  ]);

  return NextResponse.json(
    {
      currentAdminId: admin.identity.userId,
      admins: admins.map((user) => ({
        ...user,
        roleAssignments: user.roleAssignments.map((assignment) => ({
          code: assignment.role.code,
          label: assignment.role.label
        }))
      })),
      recentUsers
    },
    { status: 200 }
  );
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  try {
    const body = await req.json();
    const input = teamActionSchema.parse(body);

    const target = await prisma.user.findFirst({
      where: input.userId ? { id: input.userId } : { email: input.email?.trim().toLowerCase() },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        roleAssignments: {
          select: {
            role: {
              select: {
                code: true
              }
            }
          }
        }
      }
    });

    if (!target) {
      return NextResponse.json({ error: "No encontramos un usuario registrado con ese correo." }, { status: 404 });
    }

    const roleAdmin = await prisma.role.upsert({
      where: { code: UserRole.ADMIN },
      update: { label: "Admin" },
      create: { code: UserRole.ADMIN, label: "Admin" }
    });
    const roleCustomer = await prisma.role.upsert({
      where: { code: UserRole.CUSTOMER },
      update: { label: "Cliente" },
      create: { code: UserRole.CUSTOMER, label: "Cliente" }
    });
    const rolePro = await prisma.role.upsert({
      where: { code: UserRole.PRO },
      update: { label: "Tasker" },
      create: { code: UserRole.PRO, label: "Tasker" }
    });

    if (input.action === "grant") {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.userRoleAssignment.upsert({
          where: {
            userId_roleId: {
              userId: target.id,
              roleId: roleAdmin.id
            }
          },
          update: {},
          create: {
            userId: target.id,
            roleId: roleAdmin.id
          }
        });

        return tx.user.update({
          where: { id: target.id },
          data: { role: UserRole.ADMIN },
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true
          }
        });
      });

      return NextResponse.json(
        {
          ok: true,
          message: `${updated.fullName} ahora tiene acceso al backoffice.`,
          user: updated
        },
        { status: 200 }
      );
    }

    const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (target.role === UserRole.ADMIN && adminCount <= 1) {
      return NextResponse.json({ error: "Debe existir al menos un admin activo en WeTask." }, { status: 409 });
    }

    const remainingRoleCodes = target.roleAssignments
      .map((assignment) => assignment.role.code)
      .filter((code) => code !== UserRole.ADMIN);
    const nextRole = remainingRoleCodes.includes(UserRole.PRO) ? UserRole.PRO : UserRole.CUSTOMER;
    const fallbackRoleId = nextRole === UserRole.PRO ? rolePro.id : roleCustomer.id;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({
        where: {
          userId: target.id,
          roleId: roleAdmin.id
        }
      });

      await tx.userRoleAssignment.upsert({
        where: {
          userId_roleId: {
            userId: target.id,
            roleId: fallbackRoleId
          }
        },
        update: {},
        create: {
          userId: target.id,
          roleId: fallbackRoleId
        }
      });

      return tx.user.update({
        where: { id: target.id },
        data: { role: nextRole },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true
        }
      });
    });

    return NextResponse.json(
      {
        ok: true,
        message: `${updated.fullName} vuelve a tener rol ${formatRoleLabel(updated.role).toLowerCase()}.`,
        user: updated
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar el acceso interno",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
