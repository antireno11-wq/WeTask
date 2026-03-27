import { AuthProvider, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRequest } from "@/lib/admin-access";
import { buildPasswordResetEmailTemplate, getEmailDeliveryConfig, sendPlatformEmail } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { hashPassword, randomToken, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";

const teamActionSchema = z.object({
  action: z.enum(["grant", "revoke", "delete_user", "create_admin", "send_reset"]),
  userId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  fullName: z.string().trim().min(3).optional(),
  password: z.string().min(8).optional()
});

const teamListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(20).default(5),
  roleFilter: z.enum(["all", "taskers", "customers"]).default("all"),
  sortBy: z.enum(["newest", "oldest", "activity", "name"]).default("newest")
});

function formatRoleLabel(role: UserRole) {
  if (role === UserRole.ADMIN) return "Admin";
  if (role === UserRole.PRO) return "Tasker";
  return "Cliente";
}

function hasAdminAssignment(roleAssignments: Array<{ role: { code: UserRole } }>) {
  return roleAssignments.some((assignment) => assignment.role.code === UserRole.ADMIN);
}

function formatBookingActivity(kind: "customer" | "pro", booking: { updatedAt: Date; service: { name: string } | null } | null) {
  if (!booking) return null;
  return {
    at: booking.updatedAt,
    label:
      kind === "customer"
        ? `Reserva actualizada como cliente · ${booking.service?.name ?? "Servicio"}`
        : `Reserva actualizada como tasker · ${booking.service?.name ?? "Servicio"}`
  };
}

function roleFilterWhere(roleFilter: "all" | "taskers" | "customers") {
  if (roleFilter === "taskers") {
    return {
      OR: [{ role: UserRole.PRO }, { roleAssignments: { some: { role: { code: UserRole.PRO } } } }]
    };
  }

  if (roleFilter === "customers") {
    return {
      OR: [{ role: UserRole.CUSTOMER }, { roleAssignments: { some: { role: { code: UserRole.CUSTOMER } } } }]
    };
  }

  return {};
}

function userOrderBy(sortBy: "newest" | "oldest" | "activity" | "name") {
  if (sortBy === "oldest") {
    return [{ createdAt: "asc" as const }, { updatedAt: "desc" as const }];
  }

  if (sortBy === "activity") {
    return [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }];
  }

  if (sortBy === "name") {
    return [{ fullName: "asc" as const }, { createdAt: "desc" as const }];
  }

  return [{ createdAt: "desc" as const }, { updatedAt: "desc" as const }];
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  const query = teamListQuerySchema.parse({
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: req.nextUrl.searchParams.get("pageSize") ?? undefined,
    roleFilter: req.nextUrl.searchParams.get("roleFilter") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? undefined
  });
  const skip = (query.page - 1) * query.pageSize;
  const roleWhere = roleFilterWhere(query.roleFilter);

  const [admins, totalRecentUsers, recentUsers] = await Promise.all([
    prisma.user.findMany({
      where: {
        roleAssignments: {
          some: {
            role: {
              code: UserRole.ADMIN
            }
          }
        }
      },
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
    prisma.user.count({ where: roleWhere }),
    prisma.user.findMany({
      where: roleWhere,
      orderBy: userOrderBy(query.sortBy),
      skip,
      take: query.pageSize,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        roleAssignments: {
          select: {
            role: {
              select: {
                code: true,
                label: true
              }
            }
          }
        },
        professionalProfile: {
          select: {
            isVerified: true,
            verificationStatus: true,
            updatedAt: true
          }
        },
        cleaningOnboarding: {
          select: {
            status: true,
            updatedAt: true
          }
        },
        bookings: {
          orderBy: [{ updatedAt: "desc" }],
          take: 1,
          select: {
            updatedAt: true,
            service: {
              select: {
                name: true
              }
            }
          }
        },
        proBookings: {
          orderBy: [{ updatedAt: "desc" }],
          take: 1,
          select: {
            updatedAt: true,
            service: {
              select: {
                name: true
              }
            }
          }
        },
        notifications: {
          orderBy: [{ createdAt: "desc" }],
          take: 1,
          select: {
            title: true,
            createdAt: true
          }
        }
      }
    })
  ]);

  return NextResponse.json(
    {
      currentAdminId: admin.identity.userId,
      page: query.page,
      pageSize: query.pageSize,
      roleFilter: query.roleFilter,
      sortBy: query.sortBy,
      totalRecentUsers,
      totalPages: Math.max(1, Math.ceil(totalRecentUsers / query.pageSize)),
      admins: admins.map((user) => ({
        ...user,
          roleAssignments: user.roleAssignments.map((assignment) => ({
            code: assignment.role.code,
            label: assignment.role.label
        }))
      })),
      recentUsers: recentUsers.map((user) => {
        const activityCandidates = [
          user.notifications[0]
            ? {
                at: user.notifications[0].createdAt,
                label: `Notificación reciente · ${user.notifications[0].title}`
              }
            : null,
          user.cleaningOnboarding
            ? {
                at: user.cleaningOnboarding.updatedAt,
                label: `Onboarding ${user.cleaningOnboarding.status.toLowerCase().replace(/_/g, " ")}`
              }
            : null,
          user.professionalProfile
            ? {
                at: user.professionalProfile.updatedAt,
                label: `Perfil profesional ${user.professionalProfile.verificationStatus.toLowerCase()}`
              }
            : null,
          formatBookingActivity("customer", user.bookings[0] ?? null),
          formatBookingActivity("pro", user.proBookings[0] ?? null),
          {
            at: user.updatedAt,
            label: "Cuenta actualizada"
          }
        ].filter(Boolean) as Array<{ at: Date; label: string }>;

        activityCandidates.sort((a, b) => b.at.getTime() - a.at.getTime());
        const latest = activityCandidates[0] ?? null;

        return {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          roleAssignments: user.roleAssignments.map((assignment) => ({
            code: assignment.role.code,
            label: assignment.role.label
          })),
          createdAt: user.createdAt,
          professionalProfile: user.professionalProfile
            ? {
                isVerified: user.professionalProfile.isVerified,
                verificationStatus: user.professionalProfile.verificationStatus
              }
            : null,
          cleaningOnboarding: user.cleaningOnboarding
            ? {
                status: user.cleaningOnboarding.status
              }
            : null,
          latestActivityAt: latest?.at ?? user.createdAt,
          latestActivityLabel: latest?.label ?? "Cuenta creada"
        };
      })
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

    const target = input.action === "create_admin"
      ? null
      : await prisma.user.findFirst({
      where: input.userId ? { id: input.userId } : { email: input.email?.trim().toLowerCase() },
      select: {
        id: true,
        fullName: true,
        email: true,
        authProvider: true,
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
        _count: {
          select: {
            bookings: true,
            proBookings: true,
            sentMessages: true,
            reviewsGiven: true,
            payouts: true
          }
        }
      }
    });

    if (input.action !== "create_admin" && !target) {
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

    if (input.action === "create_admin") {
      const email = input.email?.trim().toLowerCase();
      const fullName = input.fullName?.trim();
      const password = input.password;

      if (!email || !fullName || !password) {
        return NextResponse.json(
          { error: "Debes ingresar nombre, correo y contraseña para crear el administrador." },
          { status: 400 }
        );
      }

      const existing = await prisma.user.findUnique({
        where: { email },
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
      if (existing) {
        if (hasAdminAssignment(existing.roleAssignments)) {
          return NextResponse.json({ error: "Ese correo ya tiene acceso administrador." }, { status: 409 });
        }

        await prisma.$transaction([
          prisma.userRoleAssignment.create({
            data: {
              userId: existing.id,
              roleId: roleAdmin.id
            }
          }),
          prisma.user.update({
            where: { id: existing.id },
            data: {
              emailVerifiedAt: new Date()
            }
          })
        ]);

        return NextResponse.json(
          {
            ok: true,
            message: `${existing.fullName} ya existía en WeTask y ahora también tiene acceso administrador.`
          },
          { status: 200 }
        );
      }

      const passwordHash = await hashPassword(password);
      const created = await prisma.user.create({
        data: {
          fullName,
          email,
          role: UserRole.ADMIN,
          authProvider: AuthProvider.EMAIL,
          passwordHash,
          termsAcceptedAt: new Date(),
          emailVerifiedAt: new Date(),
          roleAssignments: {
            create: {
              roleId: roleAdmin.id
            }
          }
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true
        }
      });

      return NextResponse.json(
        {
          ok: true,
          message: `${created.fullName} fue creado como administrador.`,
          user: created
        },
        { status: 201 }
      );
    }

    if (!target) {
      return NextResponse.json({ error: "No encontramos un usuario registrado con ese correo." }, { status: 404 });
    }

    const targetHasAdmin = hasAdminAssignment(target.roleAssignments);

    if (input.action === "send_reset") {
      if (!targetHasAdmin) {
        return NextResponse.json({ error: "Esta acción está disponible solo para administradores." }, { status: 409 });
      }

      if (target.authProvider !== AuthProvider.EMAIL) {
        return NextResponse.json({ error: "Este admin entra con Google o Apple. No se le puede enviar recuperación por contraseña." }, { status: 409 });
      }

      const emailConfig = getEmailDeliveryConfig();
      if (!emailConfig.configured) {
        return NextResponse.json(
          { error: `El correo no está configurado todavía. Faltan: ${emailConfig.missing.join(", ")}` },
          { status: 409 }
        );
      }

      const token = randomToken(24);
      await prisma.passwordResetToken.create({
        data: {
          userId: target.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + 1000 * 60 * 30)
        }
      });

      const appUrl = resolvePublicAppUrl(req);
      const resetUrl = `${appUrl}/restablecer-contrasena?token=${encodeURIComponent(token)}`;

      await sendPlatformEmail({
        to: target.email,
        subject: "Restablece tu contraseña de administrador en WeTask",
        text:
          `Hola ${target.fullName}.\n\n` +
          `Desde el backoffice de WeTask se solicitó el restablecimiento de tu contraseña.\n\n` +
          `Usa este enlace para crear una nueva clave:\n${resetUrl}\n\n` +
          `Este enlace vence en 30 minutos.\n\nEquipo WeTask`,
        html: buildPasswordResetEmailTemplate({
          fullName: target.fullName,
          resetUrl,
          appUrl
        })
      });

      return NextResponse.json(
        {
          ok: true,
          message: `Le enviamos un correo de restablecimiento a ${target.email}.`
        },
        { status: 200 }
      );
    }

    if (input.action === "delete_user") {
      const primaryAdminEmail = process.env.PRIMARY_ADMIN_EMAIL?.trim().toLowerCase() ?? null;

      if (target.id === admin.identity.userId) {
        return NextResponse.json({ error: "No puedes borrar la cuenta con la que estás dentro del backoffice." }, { status: 409 });
      }

      if (target.email.toLowerCase() === primaryAdminEmail) {
        return NextResponse.json({ error: "No se puede borrar el administrador principal configurado en WeTask." }, { status: 409 });
      }

      if (targetHasAdmin) {
        return NextResponse.json({ error: "Primero quítale el acceso admin. Este borrado rápido no elimina cuentas admin." }, { status: 409 });
      }

      const hasLinkedActivity =
        target._count.bookings > 0 ||
        target._count.proBookings > 0 ||
        target._count.sentMessages > 0 ||
        target._count.reviewsGiven > 0 ||
        target._count.payouts > 0;

      if (hasLinkedActivity) {
        return NextResponse.json(
          {
            error:
              "No se puede borrar esta cuenta desde el backoffice rápido porque ya tiene reservas o actividad asociada. Si quieres, hacemos una limpieza más controlada."
          },
          { status: 409 }
        );
      }

      await prisma.user.delete({
        where: { id: target.id }
      });

      return NextResponse.json(
        {
          ok: true,
          message: `${target.fullName} fue eliminado de WeTask.`
        },
        { status: 200 }
      );
    }

    if (input.action === "grant") {
      if (targetHasAdmin) {
        return NextResponse.json({ error: "Ese usuario ya tiene acceso administrador." }, { status: 409 });
      }

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

        return tx.user.findUniqueOrThrow({
          where: { id: target.id },
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

    const adminCount = await prisma.user.count({
      where: {
        roleAssignments: {
          some: {
            role: {
              code: UserRole.ADMIN
            }
          }
        }
      }
    });
    if (targetHasAdmin && adminCount <= 1) {
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

      const shouldDowngradePrimaryRole = target.role === UserRole.ADMIN;

      if (shouldDowngradePrimaryRole) {
        await tx.user.update({
          where: { id: target.id },
          data: { role: nextRole }
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: target.id },
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
