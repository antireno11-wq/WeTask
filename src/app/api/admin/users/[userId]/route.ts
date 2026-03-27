import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatRoleLabel(role: UserRole) {
  if (role === UserRole.ADMIN) return "Admin";
  if (role === UserRole.PRO) return "Tasker";
  return "Cliente";
}

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const admin = await requireAdminRequest(_req);
  if (!admin.ok) return admin.response;

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      authProvider: true,
      createdAt: true,
      updatedAt: true,
      termsAcceptedAt: true,
      emailVerifiedAt: true,
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
      addresses: {
        orderBy: [{ updatedAt: "desc" }],
        take: 3,
        select: {
          id: true,
          label: true,
          street: true,
          city: true,
          postalCode: true,
          region: true,
          country: true,
          updatedAt: true
        }
      },
      _count: {
        select: {
          bookings: true,
          proBookings: true,
          notifications: true,
          paymentMethods: true
        }
      },
      bookings: {
        orderBy: [{ updatedAt: "desc" }],
        take: 5,
        select: {
          id: true,
          updatedAt: true,
          scheduledAt: true,
          status: true,
          totalPriceClp: true,
          service: {
            select: {
              name: true
            }
          }
        }
      },
      proBookings: {
        orderBy: [{ updatedAt: "desc" }],
        take: 5,
        select: {
          id: true,
          updatedAt: true,
          scheduledAt: true,
          status: true,
          totalPriceClp: true,
          service: {
            select: {
              name: true
            }
          }
        }
      },
      notifications: {
        orderBy: [{ createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          body: true,
          createdAt: true,
          isRead: true
        }
      },
      professionalProfile: {
        select: {
          id: true,
          avatarUrl: true,
          bio: true,
          isVerified: true,
          verificationStatus: true,
          coverageStreet: true,
          coverageComuna: true,
          coverageCity: true,
          hourlyRateFromClp: true,
          taskerServices: {
            where: { isActive: true },
            orderBy: [{ createdAt: "asc" }],
            select: {
              priceClp: true,
              service: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      },
      cleaningOnboarding: {
        select: {
          status: true,
          categorySlug: true,
          baseCommune: true,
          serviceCommunes: true,
          profilePhotoUrl: true,
          submittedAt: true
        }
      }
    }
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json(
    {
      user: {
        ...user,
        roleLabel: formatRoleLabel(user.role),
        roleAssignments: user.roleAssignments.map((assignment) => ({
          code: assignment.role.code,
          label: assignment.role.label
        }))
      }
    },
    { status: 200 }
  );
}
