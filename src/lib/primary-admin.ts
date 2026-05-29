import { AuthProvider, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security";

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

declare global {
  var primaryAdminSeeded: boolean | undefined;
}

export async function ensurePrimaryAdminUser() {
  if (global.primaryAdminSeeded) {
    return null;
  }

  const email = process.env.PRIMARY_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PRIMARY_ADMIN_PASSWORD?.trim();
  const fullName = process.env.PRIMARY_ADMIN_FULL_NAME?.trim() || "Administrador principal WeTask";

  if (!email || !password) {
    return null;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      role: UserRole.ADMIN,
      authProvider: AuthProvider.EMAIL,
      passwordHash,
      emailVerifiedAt: now,
      termsAcceptedAt: now
    },
    create: {
      email,
      fullName,
      role: UserRole.ADMIN,
      authProvider: AuthProvider.EMAIL,
      passwordHash,
      emailVerifiedAt: now,
      termsAcceptedAt: now
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true
    }
  });

  await ensureRoleAssignment(user.id, UserRole.ADMIN, "Admin");

  global.primaryAdminSeeded = true;
  return user;
}

