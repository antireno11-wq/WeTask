import { Prisma, UserRole } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const userId = req.nextUrl.searchParams.get("userId") ?? identity.userId;
    if (!userId) {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }
    if (identity.role !== UserRole.ADMIN && identity.userId !== userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const unreadParam = req.nextUrl.searchParams.get("unread");
    const onlyUnread = unreadParam === "true";
    const cursor = req.nextUrl.searchParams.get("cursor") ?? null;
    const pageSizeRaw = Number(req.nextUrl.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(Math.max(pageSizeRaw, 5), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    const where: Prisma.NotificationWhereInput = { userId };
    if (onlyUnread) where.isRead = false;

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: pageSize + 1,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined
      }),
      prisma.notification.count({ where: { userId, isRead: false } })
    ]);

    const hasMore = items.length > pageSize;
    const visible = hasMore ? items.slice(0, pageSize) : items;
    const nextCursor = hasMore ? visible[visible.length - 1]?.id ?? null : null;

    return NextResponse.json(
      { notifications: visible, unreadCount, nextCursor },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar notificaciones",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}

const patchSchema = z.object({
  action: z.enum(["markAsRead", "markAllAsRead"]),
  notificationIds: z.array(z.string().min(1)).max(200).optional()
});

export async function PATCH(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!identity.userId || !hasRole(identity.role, [UserRole.CUSTOMER, UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const input = patchSchema.parse(body);

    if (input.action === "markAllAsRead") {
      const result = await prisma.notification.updateMany({
        where: { userId: identity.userId, isRead: false },
        data: { isRead: true }
      });
      return NextResponse.json({ ok: true, updated: result.count }, { status: 200 });
    }

    if (!input.notificationIds || input.notificationIds.length === 0) {
      return NextResponse.json({ error: "notificationIds requerido para markAsRead" }, { status: 400 });
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: identity.userId,
        id: { in: input.notificationIds },
        isRead: false
      },
      data: { isRead: true }
    });
    return NextResponse.json({ ok: true, updated: result.count }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar notificaciones",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
