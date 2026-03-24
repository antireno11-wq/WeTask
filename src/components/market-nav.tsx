"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

export function MarketNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<{ fullName?: string | null; role?: string | null } | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { session?: { fullName?: string | null; role?: string | null } | null };
        setSession(data.session ?? null);
      } catch {
        setSession(null);
      }
    };
    void loadSession();
  }, [pathname]);

  useEffect(() => {
    const loadNotifications = async () => {
      if (!session?.role || (session.role !== "CUSTOMER" && session.role !== "PRO")) {
        setNotificationCount(0);
        return;
      }

      try {
        const response = await fetch("/api/marketplace/notifications");
        const data = (await response.json()) as { notifications?: Array<{ id: string }> };
        if (!response.ok) {
          setNotificationCount(0);
          return;
        }
        setNotificationCount(data.notifications?.length ?? 0);
      } catch {
        setNotificationCount(0);
      }
    };
    void loadNotifications();
  }, [session?.role, pathname]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    router.push("/");
    router.refresh();
  };

  const role = session?.role ?? null;
  const roleLabel = role === "PRO" ? "Tasker" : role === "ADMIN" ? "Admin" : role === "CUSTOMER" ? "Cliente" : role;
  const accountHref = role === "PRO" ? "/pro" : "/cliente";
  const notificationHref = role === "PRO" ? "/pro?tab=notificaciones" : "/cliente?tab=notificaciones";
  const showNotificationBell = role === "PRO" || role === "CUSTOMER";
  const isAdminArea = pathname.startsWith("/admin");
  const primaryLinks = isAdminArea
    ? []
    : [
        { href: "/", label: "Inicio" },
        { href: "/como-funciona", label: "Cómo funciona" },
        { href: "/services", label: "Servicios" },
      ];
  const guestLinks = isAdminArea
    ? []
    : [
        { href: "/trabaja-con-nosotros", label: "Soy tasker" },
        { href: "/registro", label: "Soy cliente" }
      ];

  return (
    <header className="market-nav">
      <Link href="/" className="brand-link">
        <BrandLogo className="brand-logo" width={170} height={68} variant="white-wordmark" />
      </Link>
      <div className="nav-right">
        <nav>
          {primaryLinks.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="auth-nav">
          {session?.role ? <span className="auth-badge">{session.fullName ?? "Usuario"} · {roleLabel}</span> : null}
          {session?.role ? (
            <>
              {showNotificationBell ? (
                <Link href={notificationHref} className="nav-link auth-btn nav-bell-link" aria-label="Ver notificaciones">
                  <span className="nav-bell-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 4a4 4 0 0 0-4 4v1.2c0 .9-.27 1.77-.78 2.5L5.7 13.9c-.54.78.02 1.85.97 1.85h10.66c.95 0 1.51-1.07.97-1.85l-1.52-2.2A4.36 4.36 0 0 1 16 9.2V8a4 4 0 0 0-4-4Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M9.75 18a2.25 2.25 0 0 0 4.5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                  {notificationCount > 0 ? <span className="nav-bell-count">{notificationCount > 99 ? "99+" : notificationCount}</span> : null}
                </Link>
              ) : null}
              <Link href={accountHref} className="nav-link auth-btn">
                Mi cuenta
              </Link>
              <button type="button" className="nav-link auth-btn" onClick={logout}>
                Salir
              </button>
            </>
          ) : (
            <>
              {guestLinks.map((item) => (
                <Link key={item.href} href={item.href} className="nav-link auth-btn">
                  {item.label}
                </Link>
              ))}
              <Link href="/ingresar" className="nav-link auth-btn auth-login-pill">
                Acceder
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
